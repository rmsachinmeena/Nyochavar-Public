import bcrypt from 'bcryptjs';
import {
  userModel,
  orderModel,
  wishlistModel,
  notificationModel,
  cartModel,
  subscriberModel
} from '../models/index.js';
import { auditLogger } from '../services/auditLogger.js';
import { revokeAllSessionsForUser } from '../src/services/tokenService.js';
import { phoneVerificationService } from '../services/phoneVerificationService.js';

// An address "Location" is only ever a Google Maps link; anything else is dropped (left empty)
const cleanLocationLink = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase();
    const isGoogleMaps =
      (['google.com', 'www.google.com', 'maps.google.com'].includes(host) && (url.pathname.startsWith('/maps') || host === 'maps.google.com')) ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps'));
    return url.protocol === 'https:' && isGoogleMaps ? url.toString().slice(0, 500) : '';
  } catch {
    return '';
  }
};

const last10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// An address whose number is verified keeps that number for good (only the rest of the address can change).
// The account number, once verified, counts for every address that uses it.
const withVerifiedFlags = (addresses, user) =>
  addresses.map((address) => ({
    ...address,
    phone_verified:
      Boolean(address.phone_verified) ||
      Boolean(user?.is_phone_verified && last10(address.phone) && last10(address.phone) === last10(user.phone)),
  }));

// Returns an error message when this number still has to be verified before it can be saved, otherwise null
const unverifiedPhoneMessage = async (user, phone) => {
  if (!(await phoneVerificationService.isVerificationRequired())) return null;
  if (last10(phone).length !== 10) return 'Enter a valid 10-digit mobile number.';
  const verified = await phoneVerificationService.isPhoneVerified({ phone, userId: user.id });
  return verified ? null : 'Please verify this mobile number first.';
};

// Helper to parse multiple addresses stored in users.address_line
const parseUserAddresses = (user) => {
  if (!user) return [];
  if (user.address_line && (user.address_line.startsWith('[') || user.address_line.startsWith('{'))) {
    try {
      const parsed = JSON.parse(user.address_line);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // fallback to plain string
    }
  }

  if (user.address_line || user.city || user.pincode) {
    return [{
      id: 'addr_default',
      label: 'Home',
      name: user.name || 'Valued Client',
      phone: user.phone || '',
      address_line: user.address_line || '',
      city: user.city || '',
      pincode: user.pincode || '',
      is_default: true
    }];
  }

  return [];
};

export const userController = {
  // Get All Users (for Admin Search & Directory)
  getAllUsers: async (req, res) => {
    try {
      const users = await userModel.findAll();
      const safeUsers = users.map(({ password_hash, otp_code, otp_expiry, ...u }) => u);
      res.status(200).json({ success: true, users: safeUsers, count: safeUsers.length });
    } catch (error) {
      console.error('Error fetching all users:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  },

  // Get User Profile
  getProfile: async (req, res) => {
    try {
      const { id } = req.params;
      let user = await userModel.findById(id);

      // Fallback: if id is an email
      if (!user && id.includes('@')) {
        user = await userModel.findByEmail(id);
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Do not return password_hash or otp in profile response
      const { password_hash, otp_code, otp_expiry, ...safeUser } = user;
      
      // Attach parsed multiple addresses
      const addresses = withVerifiedFlags(parseUserAddresses(user), user);
      const defaultAddress = addresses.find(a => a.is_default) || addresses[0] || null;

      res.status(200).json({ 
        user: {
          ...safeUser,
          // If address_line contains JSON, show default address line as string for backward compatibility
          address_line: defaultAddress ? defaultAddress.address_line : (safeUser.address_line || ''),
          city: defaultAddress ? defaultAddress.city : (safeUser.city || ''),
          pincode: defaultAddress ? defaultAddress.pincode : (safeUser.pincode || ''),
          addresses: addresses
        }
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch profile' });
    }
  },

  // Update User Profile
  updateProfile: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, address_line, city, pincode, addresses } = req.body;

      let user = await userModel.findById(id);
      if (!user && id.includes('@')) {
        user = await userModel.findByEmail(id);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // An account made with a mobile number has no email: the customer may add one here. An email already on the
      // account is never changed from this form.
      let emailToAdd;
      const typedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (typedEmail && !user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail) || typedEmail.length > 254) {
          return res.status(400).json({ error: 'Please enter a valid email address' });
        }
        const emailOwner = await userModel.findByEmail(typedEmail);
        if (emailOwner && emailOwner.id !== user.id) {
          return res.status(409).json({ error: 'An account with this email address already exists.' });
        }
        emailToAdd = typedEmail;
      }

      // The first number an account verifies is final
      if (phone && user.is_phone_verified && user.phone && last10(phone) !== last10(user.phone)) {
        return res.status(409).json({ code: 'PHONE_LOCKED', error: 'Your verified mobile number cannot be changed.' });
      }

      const existingAddresses = withVerifiedFlags(parseUserAddresses(user), user);
      let addressLineToSave = address_line;

      // If user passed multiple addresses array
      if (Array.isArray(addresses) && addresses.length > 0) {
        // The verified number of an address cannot be changed or claimed from here
        addressLineToSave = JSON.stringify(
          addresses.map((incoming) => {
            const current = existingAddresses.find((a) => a.id === incoming.id);
            return current?.phone_verified
              ? { ...incoming, phone: current.phone, phone_verified: true }
              : { ...incoming, phone_verified: false };
          })
        );
      } else if (address_line && !address_line.startsWith('[')) {
        // Keep existing addresses list and update default
        let currentAddresses = existingAddresses;
        if (currentAddresses.length === 0) {
          currentAddresses = [{
            id: 'addr_' + Date.now(),
            label: 'Home',
            name: name || user.name,
            phone: phone || user.phone || '',
            address_line,
            city: city || '',
            pincode: pincode || '',
            is_default: true
          }];
        } else {
          const defaultIdx = currentAddresses.findIndex(a => a.is_default);
          const targetIdx = defaultIdx >= 0 ? defaultIdx : 0;
          currentAddresses[targetIdx] = {
            ...currentAddresses[targetIdx],
            name: name || currentAddresses[targetIdx].name,
            phone: currentAddresses[targetIdx].phone_verified ? currentAddresses[targetIdx].phone : (phone || currentAddresses[targetIdx].phone),
            address_line,
            city: city || currentAddresses[targetIdx].city,
            pincode: pincode || currentAddresses[targetIdx].pincode
          };
        }
        addressLineToSave = JSON.stringify(currentAddresses);
      }

      const updatedUser = await userModel.updateProfile(user.id, {
        name,
        phone,
        email: emailToAdd,
        address_line: addressLineToSave,
        city,
        pincode
      });

      const parsedAddresses = withVerifiedFlags(parseUserAddresses(updatedUser), updatedUser);
      const defaultAddr = parsedAddresses.find(a => a.is_default) || parsedAddresses[0] || null;

      res.status(200).json({ 
        message: 'Profile updated successfully', 
        user: {
          ...updatedUser,
          address_line: defaultAddr ? defaultAddr.address_line : updatedUser.address_line,
          addresses: parsedAddresses
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  },

  // Change Password
  changePassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current password and new password are required' });
      }

      let user = await userModel.findById(id);
      if (!user && id.includes('@')) {
        user = await userModel.findByEmail(id);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await userModel.updatePassword(user.id, newHash);

      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: error.message || 'Failed to change password' });
    }
  },

  // Set / Initialize Password (specifically for Google signup users or direct password creation)
  setPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword, password } = req.body;
      const targetPassword = newPassword || password;

      if (!targetPassword || String(targetPassword).trim().length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      let user = await userModel.findById(id);
      if (!user && id.includes('@')) {
        user = await userModel.findByEmail(id);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(String(targetPassword).trim(), salt);

      await userModel.updatePassword(user.id, newHash);

      res.status(200).json({
        success: true,
        message: 'Password set successfully! You can now log in anytime with your email and this password.'
      });
    } catch (error) {
      console.error('Error setting password:', error);
      res.status(500).json({ error: error.message || 'Failed to set password' });
    }
  },

  // -------------------------------------------------------------
  // MULTIPLE ADDRESSES MANAGEMENT
  // -------------------------------------------------------------
  // Get all saved addresses for a user
  getAddresses: async (req, res) => {
    try {
      const { userId } = req.params;
      let user = await userModel.findById(userId);
      if (!user && userId.includes('@')) {
        user = await userModel.findByEmail(userId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const addresses = withVerifiedFlags(parseUserAddresses(user), user);
      res.status(200).json({ addresses });
    } catch (error) {
      console.error('Error fetching addresses:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch addresses' });
    }
  },

  // Add a new address
  addAddress: async (req, res) => {
    try {
      const { userId } = req.params;
      const { label, name, phone, address_line, city, pincode, is_default } = req.body;

      // The location (a Google Maps link) is optional
      if (!address_line || !city) {
        return res.status(400).json({ error: 'Address and delivery area are required' });
      }

      let user = await userModel.findById(userId);
      if (!user && userId.includes('@')) {
        user = await userModel.findByEmail(userId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Every address needs a verified number (the account number is used when none is typed)
      const addressPhone = phone || (user.is_phone_verified ? user.phone : '') || '';
      const phoneProblem = await unverifiedPhoneMessage(user, addressPhone);
      if (phoneProblem) {
        return res.status(400).json({ code: 'PHONE_NOT_VERIFIED', error: phoneProblem });
      }
      const numberIsVerified = await phoneVerificationService.isVerificationRequired();

      let addresses = withVerifiedFlags(parseUserAddresses(user), user);
      const shouldBeDefault = is_default || addresses.length === 0;

      if (shouldBeDefault) {
        addresses = addresses.map(a => ({ ...a, is_default: false }));
      }

      const newAddress = {
        id: 'addr_' + Date.now(),
        label: label || 'Home',
        name: name || user.name || 'Valued Client',
        phone: addressPhone,
        phone_verified: numberIsVerified,
        address_line,
        city,
        pincode: cleanLocationLink(pincode),
        is_default: shouldBeDefault
      };

      addresses.push(newAddress);

      // Save to Supabase
      const defaultAddr = addresses.find(a => a.is_default) || newAddress;
      await userModel.updateProfile(user.id, {
        address_line: JSON.stringify(addresses),
        city: defaultAddr.city,
        pincode: defaultAddr.pincode
      });

      res.status(201).json({ 
        message: 'Address added successfully', 
        address: newAddress, 
        addresses: withVerifiedFlags(addresses, user) 
      });
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ error: error.message || 'Failed to add address' });
    }
  },

  // Update an existing address
  updateAddress: async (req, res) => {
    try {
      const { userId, addressId } = req.params;
      const { label, name, phone, address_line, city, pincode, is_default } = req.body;

      let user = await userModel.findById(userId);
      if (!user && userId.includes('@')) {
        user = await userModel.findByEmail(userId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let addresses = withVerifiedFlags(parseUserAddresses(user), user);
      const addrIndex = addresses.findIndex(a => a.id === addressId);
      if (addrIndex === -1) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // The verified number of an address is fixed. A different number goes in a new address.
      const current = addresses[addrIndex];
      const numberChanged = Boolean(phone) && last10(phone) !== last10(current.phone);
      if (current.phone_verified && numberChanged) {
        return res.status(409).json({ code: 'PHONE_LOCKED', error: 'The verified number of an address cannot be changed. Add a new address for a different number.' });
      }
      let phoneVerified = current.phone_verified;
      if (!phoneVerified) {
        const checkedPhone = numberChanged ? phone : current.phone;
        const phoneProblem = checkedPhone ? await unverifiedPhoneMessage(user, checkedPhone) : null;
        if (numberChanged && phoneProblem) {
          return res.status(400).json({ code: 'PHONE_NOT_VERIFIED', error: phoneProblem });
        }
        phoneVerified = Boolean(checkedPhone) && !phoneProblem && (await phoneVerificationService.isVerificationRequired());
      }

      if (is_default) {
        addresses = addresses.map(a => ({ ...a, is_default: false }));
      }

      addresses[addrIndex] = {
        ...addresses[addrIndex],
        label: label || addresses[addrIndex].label,
        name: name || addresses[addrIndex].name,
        phone: current.phone_verified ? current.phone : (phone || current.phone),
        phone_verified: phoneVerified,
        address_line: address_line || addresses[addrIndex].address_line,
        city: city || addresses[addrIndex].city,
        // Sent empty (or not a Google Maps link) clears the location; not sent at all keeps the old one
        pincode: pincode === undefined ? addresses[addrIndex].pincode : cleanLocationLink(pincode),
        is_default: is_default !== undefined ? is_default : addresses[addrIndex].is_default
      };

      const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
      await userModel.updateProfile(user.id, {
        address_line: JSON.stringify(addresses),
        city: defaultAddr ? defaultAddr.city : undefined,
        pincode: defaultAddr ? defaultAddr.pincode : undefined
      });

      res.status(200).json({ 
        message: 'Address updated successfully', 
        address: addresses[addrIndex], 
        addresses: withVerifiedFlags(addresses, user) 
      });
    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({ error: error.message || 'Failed to update address' });
    }
  },

  // Delete an address
  deleteAddress: async (req, res) => {
    try {
      const { userId, addressId } = req.params;

      let user = await userModel.findById(userId);
      if (!user && userId.includes('@')) {
        user = await userModel.findByEmail(userId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let addresses = parseUserAddresses(user);
      const addrToDelete = addresses.find(a => a.id === addressId);
      if (!addrToDelete) {
        return res.status(404).json({ error: 'Address not found' });
      }

      addresses = addresses.filter(a => a.id !== addressId);

      // If we deleted the default address, make the first remaining address the default
      if (addrToDelete.is_default && addresses.length > 0) {
        addresses[0].is_default = true;
      }

      const defaultAddr = addresses.find(a => a.is_default) || null;
      await userModel.updateProfile(user.id, {
        address_line: addresses.length > 0 ? JSON.stringify(addresses) : '',
        city: defaultAddr ? defaultAddr.city : '',
        pincode: defaultAddr ? defaultAddr.pincode : ''
      });

      res.status(200).json({ 
        message: 'Address deleted successfully', 
        addresses: withVerifiedFlags(addresses, user) 
      });
    } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ error: error.message || 'Failed to delete address' });
    }
  },

  // Set an address as default
  setDefaultAddress: async (req, res) => {
    try {
      const { userId, addressId } = req.params;

      let user = await userModel.findById(userId);
      if (!user && userId.includes('@')) {
        user = await userModel.findByEmail(userId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let addresses = parseUserAddresses(user);
      const exists = addresses.some(a => a.id === addressId);
      if (!exists) {
        return res.status(404).json({ error: 'Address not found' });
      }

      addresses = addresses.map(a => ({
        ...a,
        is_default: a.id === addressId
      }));

      const defaultAddr = addresses.find(a => a.is_default);
      await userModel.updateProfile(user.id, {
        address_line: JSON.stringify(addresses),
        city: defaultAddr.city,
        pincode: defaultAddr.pincode
      });

      res.status(200).json({ 
        message: 'Default address updated successfully', 
        addresses: withVerifiedFlags(addresses, user) 
      });
    } catch (error) {
      console.error('Error setting default address:', error);
      res.status(500).json({ error: error.message || 'Failed to set default address' });
    }
  },

  // -------------------------------------------------------------
  // ORDERS, WISHLIST, NOTIFICATIONS, CART
  // -------------------------------------------------------------
  // Get User Orders
  getOrders: async (req, res) => {
    try {
      const { userId } = req.params;
      const orders = await orderModel.findByBuyerId(userId);
      res.status(200).json({ orders });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  },

  // Get User Wishlist
  getWishlist: async (req, res) => {
    try {
      const { userId } = req.params;
      const wishlist = await wishlistModel.findByUserId(userId);
      res.status(200).json({ wishlist });
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch wishlist' });
    }
  },

  // Add to Wishlist: body is { productId } or { productIds: [...] } (used to merge guest favourites on login)
  addToWishlist: async (req, res) => {
    try {
      const { userId } = req.params;
      const { productId, productIds } = req.body || {};

      const requested = Array.isArray(productIds) ? productIds : productId ? [productId] : [];
      const ids = requested.filter((id) => typeof id === 'string' && id.trim() && id.length <= 100).map((id) => id.trim());

      if (ids.length === 0 || requested.length > 200) {
        return res.status(400).json({ error: 'Send a productId or a list of up to 200 productIds' });
      }

      await wishlistModel.addMany(userId, ids);
      res.status(201).json({ message: 'Saved to wishlist' });
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      res.status(500).json({ error: error.message || 'Failed to add to wishlist' });
    }
  },

  // Remove from Wishlist
  removeFromWishlist: async (req, res) => {
    try {
      const { userId, productId } = req.params;
      await wishlistModel.remove(userId, productId);
      res.status(200).json({ message: 'Item removed from wishlist successfully' });
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      res.status(500).json({ error: error.message || 'Failed to remove from wishlist' });
    }
  },

  // Get Notifications
  getNotifications: async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await notificationModel.findByUserId(userId);
      res.status(200).json({ notifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
  },

  // Mark ALL of a user's notifications read
  markAllNotificationsRead: async (req, res) => {
    try {
      await notificationModel.markAllAsRead(req.params.userId);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to mark notifications read' });
    }
  },

  // Hide a notification from the signed-in customer's list (the row is kept)
  hideNotification: async (req, res) => {
    try {
      const hidden = await notificationModel.hideForUser(req.params.id, req.auth.id);
      if (!hidden) return res.status(404).json({ error: 'Notification not found' });
      res.status(200).json({ message: 'Notification removed' });
    } catch (error) {
      console.error('Error hiding notification:', error);
      res.status(500).json({ error: error.message || 'Failed to remove notification' });
    }
  },

  // Mark Notification Read
  markNotificationRead: async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await notificationModel.markAsRead(id);
      res.status(200).json({ message: 'Notification marked as read', notification });
    } catch (error) {
      console.error('Error updating notification:', error);
      res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
  },

  // Get Cart
  getCart: async (req, res) => {
    try {
      const { userId } = req.params;
      const cart = await cartModel.findByUserId(userId);
      res.status(200).json({ cart });
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cart' });
    }
  },

  // Newsletter Subscription
  subscribeNewsletter: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const subscriber = await subscriberModel.subscribe(cleanEmail);

      // Create superadmin notification in database
      try {
        await notificationModel.create({
          buyer_id: null,
          title: 'New Newsletter Subscriber 🎉',
          message: `${cleanEmail} subscribed to The Nyochavar Club.`,
          is_read: false
        });
      } catch (notifErr) {
        console.warn('Superadmin notification insert warning:', notifErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Thanks for subscribing — you are on the list!',
        subscriber
      });
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to subscribe.' });
    }
  },

  // Get all newsletter subscribers (for superadmin)
  getSubscribers: async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const subscribers = await subscriberModel.getAll(limit);
      return res.status(200).json({ success: true, subscribers });
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch subscribers.' });
    }
  },

  // Delete one or many customer accounts (SuperAdmin multi-select). Body: { ids: string[] }
  // Their activity is removed and they are signed out everywhere; their orders stay for the sales records.
  bulkDeleteUsers: async (req, res) => {
    try {
      const deletedIds = await userModel.deleteMany(req.body.ids);
      await Promise.all(deletedIds.map((id) => revokeAllSessionsForUser('buyer', id, 'deactivated')));

      await auditLogger.logMany({
        action: 'DELETE_USER',
        table_affected: 'users',
        record_ids: deletedIds
      });

      return res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} customer(s) deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting customers:', error);
      return res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to delete customers.' });
    }
  }
};

