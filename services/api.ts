import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ───────────────────────────────────
const API_BASE = 'https://facilgestion.site/public/v1';
const TENANT_SLUG = 'mini_super1-';
export const API_URL = `${API_BASE}/${TENANT_SLUG}`;

// ─── Axios Instance ───────────────────────────
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor — attach token from persisted store
api.interceptors.request.use(async (config) => {
    try {
        const raw = await AsyncStorage.getItem('catalogo-auth');
        if (raw) {
            const parsed = JSON.parse(raw);
            const token = parsed?.state?.token;
            if (token) {
                config.headers.Authorization = `Token ${token}`;
            }
        }
    } catch { }
    return config;
});

// Retry simple (3 intentos con backoff)
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const config = error.config;
        if (!config || config._retryCount >= 3) return Promise.reject(error);
        config._retryCount = (config._retryCount || 0) + 1;
        const delay = config._retryCount * 1000;
        await new Promise((r) => setTimeout(r, delay));
        return api(config);
    }
);

// ─── Types ────────────────────────────────────
export interface Product {
    id_producto: number;
    nombre_producto: string;
    codigo_barra: string | null;
    category: string;
    price: string;
    stock_level: 'available' | 'low' | 'out_of_stock';
    in_stock: boolean;
    image_url: string | null;
    descripcion?: string;
    unit: string;
    sells_by_weight: boolean;
}

export interface Category {
    id_categoria: number;
    nombre_categoria: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface StoreConfig {
    name: string;
    slug: string;
    primary_color: string;
    catalog_config: Record<string, unknown>;
    tenant_type: string;
}

export interface OrderItem {
    product_id: number;
    quantity: number;
}

export interface CreateOrderPayload {
    client_name: string;
    client_phone: string;
    items: OrderItem[];
    payment_method: 'EFECTIVO' | 'TRANSFERENCIA';
    notes?: string;
}

export interface OrderResponse {
    message: string;
    order: {
        id: number;
        status: string;
        status_display: string;
        payment_method: string;
        payment_status: string;
        payment_status_display: string;
        total: string;
        notes: string;
        client_name: string;
        client_phone: string;
        items: Array<{
            name_snapshot: string;
            unit_price_snapshot: string;
            quantity: string;
            subtotal: string;
            unit_snapshot: string;
        }>;
        created_at: string;
    };
}

// ─── Auth Types ──────────────────────────────
export interface OTPRequestResponse {
    message: string;
    expires_in_seconds: number;
    dev_code?: string; // Solo en dev mode
}

export interface OTPVerifyResponse {
    message: string;
    token: string;
    client: {
        id: number;
        name: string;
        phone: string;
    };
}

export interface ProfileResponse {
    id: number;
    name: string;
    phone: string;
    total_orders: number;
    last_order_at: string | null;
}

// ─── API Functions ────────────────────────────
export async function getProducts(params?: {
    page?: number;
    search?: string;
    category?: number;
}): Promise<PaginatedResponse<Product>> {
    const { data } = await api.get('/products/', { params });
    return data;
}

export async function getProduct(id: number): Promise<Product> {
    const { data } = await api.get(`/products/${id}/`);
    return data;
}

export async function getCategories(): Promise<Category[]> {
    const { data } = await api.get('/categories/');
    return data;
}

export async function getStoreConfig(): Promise<StoreConfig> {
    const { data } = await api.get('/store/');
    return data;
}

export async function createOrder(payload: CreateOrderPayload): Promise<OrderResponse> {
    const { data } = await api.post('/orders/', payload);
    return data;
}

// ─── Auth API Functions ──────────────────────
export async function requestOTP(phone: string, email: string): Promise<OTPRequestResponse> {
    const { data } = await api.post('/auth/request-otp/', { phone, email });
    return data;
}

export async function verifyOTP(phone: string, code: string, name?: string, email?: string): Promise<OTPVerifyResponse> {
    const { data } = await api.post('/auth/verify-otp/', { phone, code, name, email });
    return data;
}

export async function getProfile(): Promise<ProfileResponse> {
    const { data } = await api.get('/auth/profile/');
    return data;
}

export async function logoutAPI(): Promise<void> {
    await api.post('/auth/logout/');
}

export default api;
