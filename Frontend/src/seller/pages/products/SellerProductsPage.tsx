import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  Search,
  Filter,
  Trash2,
  Edit,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Check
} from 'lucide-react';
import { useSeller } from '../../context/SellerContext';

export const SellerProductsPage: React.FC = () => {
  const { products, toggleStockStatus, updateStockCount, deleteProduct } = useSeller();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'under_review' | 'out_of_stock'>('all');

  // Quick edit stock modal state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState<number>(0);

  // Filters
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || p.category === selectedCategory;

    let matchesStatus = true;
    if (statusFilter === 'in_stock') matchesStatus = p.inStock && p.stock > 5;
    else if (statusFilter === 'low_stock') matchesStatus = p.inStock && p.stock <= 5;
    else if (statusFilter === 'under_review') matchesStatus = p.status === 'under_review';
    else if (statusFilter === 'out_of_stock') matchesStatus = !p.inStock || p.stock === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenStockEdit = (id: string, currentStock: number) => {
    setEditingStockId(id);
    setStockInput(currentStock);
  };

  const handleSaveStock = () => {
    if (editingStockId) {
      void updateStockCount(editingStockId, Math.max(0, Number(stockInput) || 0)).catch(() => undefined);
      setEditingStockId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink">
            My Product Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your gift items, real-time stock levels, and Superadmin approvals on Nyochavar.
          </p>
        </div>

        <Link
          to="/seller/products/new"
          className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/90 pb-3">
        {[
          { id: 'all', label: `All Items (${products.length})` },
          { id: 'in_stock', label: `In Stock (${products.filter((p) => p.inStock && p.stock > 5).length})` },
          { id: 'low_stock', label: `Low Stock (${products.filter((p) => p.inStock && p.stock <= 5).length})` },
          { id: 'under_review', label: `Under Review (${products.filter((p) => p.status === 'under_review').length})` },
          { id: 'out_of_stock', label: `Out of Stock (${products.filter((p) => !p.inStock || p.stock === 0).length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as any)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-brand text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Category Dropdown Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-9 pr-4 text-xs font-medium focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {[...new Set(products.map((product) => product.category).filter(Boolean))].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">You haven't listed any products yet</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5 max-w-sm mx-auto">
              Add your handcrafted celebration hampers, fresh flower bouquets, or keepsake boxes to sell to buyers across India.
            </p>
            <Link
              to="/seller/products/new"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-dark transition active:scale-95 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>List Your First Product</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Category & SKU</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4 text-center">Inventory & Stock</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    {/* Title & Image */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 max-w-xs">
                          <p className="font-bold text-slate-900 truncate">{p.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span>⭐ {p.rating > 0 ? p.rating : 'New'}</span>
                            <span>•</span>
                            <span>{p.salesCount} sold</span>
                            {p.allowCustomNote && (
                              <span className="rounded bg-purple-50 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700">
                                Customizable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU & Category */}
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">{p.category}</span>
                      <span className="block text-[11px] font-mono text-slate-400">{p.sku}</span>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">₹{p.price.toLocaleString('en-IN')}</div>
                      <div className="text-[11px] text-slate-400 line-through">
                        ₹{p.mrp.toLocaleString('en-IN')}
                      </div>
                    </td>

                    {/* Stock Status & Quick Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {/* Instant In-Stock Switch */}
                        <button
                          type="button"
                          onClick={() => void toggleStockStatus(p.id).catch(() => undefined)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            p.inStock ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title="Click to toggle In-Stock / Out-of-Stock"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              p.inStock ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => handleOpenStockEdit(p.id, p.stock)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          {p.inStock ? `${p.stock} units` : '0 (Sold out)'}
                        </button>
                      </div>
                    </td>

                    {/* Moderation Status */}
                    <td className="py-3.5 px-4 text-center">
                      {p.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Live on Store
                        </span>
                      ) : p.status === 'under_review' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Under Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          <AlertCircle className="h-3 w-3 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to="/catalog"
                          target="_blank"
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="View live product"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => {
                            if (window.confirm('Remove this product from your store? Buyers will no longer see it.')) {
                              void deleteProduct(p.id).catch(() => undefined);
                            }
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                          title="Delete product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Edit Stock Modal */}
      {editingStockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Update Stock Quantity</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter available inventory units in your warehouse.
            </p>

            <div className="mt-4">
              <input
                type="number"
                min="0"
                value={stockInput}
                onChange={(e) => setStockInput(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-center focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditingStockId(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStock}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
              >
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
