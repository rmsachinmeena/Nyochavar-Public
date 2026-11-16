import { useEffect, useState } from 'react';
import type { CategoryItem, Product } from '../types';
import { DEFAULT_CATEGORIES, productService } from '../services/productService';

let productsCache: Product[] | null = null;
let productsRequest: Promise<Product[]> | null = null;
let categoriesCache: CategoryItem[] | null = null;
let categoriesRequest: Promise<CategoryItem[]> | null = null;

function loadProducts(force = false): Promise<Product[]> {
  if (force) productsRequest = null;
  if (!productsRequest) {
    productsRequest = productService
      .getActiveProducts()
      .then((list) => {
        productsCache = list;
        return list;
      })
      .catch(() => {
        productsRequest = null;
        return productsCache ?? [];
      });
  }
  return productsRequest;
}

function loadCategories(force = false): Promise<CategoryItem[]> {
  if (force) categoriesRequest = null;
  if (!categoriesRequest) {
    categoriesRequest = productService
      .getAllCategories()
      .then((list) => {
        categoriesCache = list;
        return list;
      })
      .catch(() => {
        categoriesRequest = null;
        return categoriesCache ?? DEFAULT_CATEGORIES;
      });
  }
  return categoriesRequest;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => productsCache ?? productService.getCachedProducts());
  const [isLoading, setIsLoading] = useState(() => productsCache === null && products.length === 0);

  useEffect(() => {
    let active = true;
    const apply = (list: Product[]) => {
      if (!active) return;
      setProducts(list);
      setIsLoading(false);
    };

    loadProducts().then(apply);
    const unsubscribe = productService.subscribeToProducts(() => {
      loadProducts(true).then(apply);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { products, isLoading };
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>(() => categoriesCache ?? DEFAULT_CATEGORIES);

  useEffect(() => {
    let active = true;
    const apply = (list: CategoryItem[]) => {
      if (active) setCategories(list);
    };

    loadCategories().then(apply);
    const unsubscribe = productService.subscribeToCategories(() => {
      loadCategories(true).then(apply);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { categories: categories.filter((category) => category.is_active !== false) };
}
