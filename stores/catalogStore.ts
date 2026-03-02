import { create } from 'zustand';
import { getProducts, getCategories, getActiveOffers, Product, Category, Oferta } from '@/services/api';

interface CatalogState {
    // Data
    products: Product[];
    categories: Category[];
    offers: Oferta[]; // New

    // Filters
    selectedCategory: number | null;
    searchQuery: string;

    // Pagination
    page: number;
    hasMore: boolean;

    // Loading
    loading: boolean;
    loadingMore: boolean;
    error: string | null;

    // Actions
    fetchProducts: (reset?: boolean) => Promise<void>;
    fetchNextPage: () => Promise<void>;
    fetchCategories: () => Promise<void>;
    setCategory: (categoryId: number | null) => void;
    setSearch: (query: string) => void;
    refresh: () => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
    products: [],
    categories: [],
    offers: [],
    selectedCategory: null,
    searchQuery: '',
    page: 1,
    hasMore: true,
    loading: false,
    loadingMore: false,
    error: null,

    fetchProducts: async (reset = false) => {
        const state = get();

        if (state.loading || state.loadingMore) return;

        const page = reset ? 1 : state.page;
        set(reset ? { loading: true, error: null } : { loadingMore: true });

        try {
            const params: Record<string, unknown> = { page };
            if (state.searchQuery.length >= 2) params.search = state.searchQuery;
            if (state.selectedCategory) params.category = state.selectedCategory;

            // Fetch products and optionally offers on first page
            const offersPromise = (reset && page === 1) ? getActiveOffers() : Promise.resolve(state.offers);
            const [data, fetchedOffers] = await Promise.all([
                getProducts(params as any),
                offersPromise
            ]);

            set({
                products: reset ? data.results : [...state.products, ...data.results],
                offers: fetchedOffers,
                hasMore: data.next !== null,
                page: page + 1,
                loading: false,
                loadingMore: false,
                error: null,
            });
        } catch (err: any) {
            set({
                loading: false,
                loadingMore: false,
                error: err.message || 'Error al cargar productos',
            });
        }
    },

    fetchNextPage: async () => {
        const state = get();
        if (!state.hasMore || state.loadingMore || state.loading) return;
        await get().fetchProducts(false);
    },

    fetchCategories: async () => {
        try {
            const data = await getCategories();
            set({ categories: data });
        } catch {
            // Silent fail — categories are non-critical
        }
    },

    setCategory: (categoryId) => {
        set({ selectedCategory: categoryId, page: 1, hasMore: true, products: [] });
        get().fetchProducts(true);
    },

    setSearch: (query) => {
        set({ searchQuery: query, page: 1, hasMore: true, products: [] });
        get().fetchProducts(true);
    },

    refresh: async () => {
        set({ page: 1, hasMore: true, products: [] });
        await Promise.all([get().fetchProducts(true), get().fetchCategories()]);
    },
}));
