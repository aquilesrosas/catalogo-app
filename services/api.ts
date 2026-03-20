import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useConfigStore } from '@/stores/configStore';

// ─── Config ───────────────────────────────────
const API_BASE = 'https://facilgestion.site/public/v1/';

// ─── Axios Instance ───────────────────────────
const api = axios.create({
    baseURL: API_BASE, // Base without slug
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Tenant and Auth interceptor
api.interceptors.request.use(async (config) => {
    try {
        const slug = useConfigStore.getState().tenantSlug;
        
        // If there's no slug, but the request isn't to a global endpoint (like auth/login without tenant? no, all our endpoints are tenant-specific)
        // We must cancel the request to prevent firing to 'https://facilgestion.site/public/v1/products/' which will 404 or fail.
        if (!slug && config.url && !config.url.startsWith('http')) {
             return Promise.reject(new Error("No_Tenant_Selected"));
        }

        if (slug && config.url && !config.url.startsWith('http')) {
            // Ensure we don't double the slug if it was already added by a retry
            if (!config.url.startsWith(slug)) {
                // Ensure URL has the tenant prefix if not absolute
                const cleanUrl = config.url.startsWith('/') ? config.url.substring(1) : config.url;
                config.url = `${slug}/${cleanUrl}`;
            }
        }

        // 2. Attach Auth Token
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

// Retry simple (3 intentos con backoff) solo si no es 4xx
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const config = error.config;
        
        // Skip retry completely for 4xx Client Errors (404, 403, 400, etc) because retrying won't change them
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return Promise.reject(error);
        }

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
    category_id: number;
    price: string;
    stock: string;
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
    client_name?: string;
    client_phone?: string;
    cliente_id?: number | null;
    source?: 'kiosk' | 'catalog' | 'qr' | 'table';
    tipo_entrega?: 'LOCAL' | 'DELIVERY' | 'MESA';
    kiosk_id?: string;
    direccion_envio?: string;
    costo_envio?: number;
    latitud?: number;
    longitud?: number;
    items: OrderItem[];
    payment_method: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO';
    payment_amount_cash?: number;
    payment_amount_transfer?: number;
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
        has_password: boolean;
    };
    requires_otp?: boolean;
    dev_code?: string;
}

export interface ProfileResponse {
    id: number;
    name: string;
    phone: string;
    email: string;
    points: number;
    total_orders: number;
    last_order_at: string | null;
}

// ─── API Functions ────────────────────────────
export async function getProducts(params?: {
    page?: number;
    search?: string;
    category?: number;
}): Promise<PaginatedResponse<Product>> {
    const { data } = await api.get('products/', { params });
    return data;
}

export async function getProduct(id: number): Promise<Product> {
    const { data } = await api.get(`products/${id}/`);
    return data;
}

export async function getCategories(): Promise<Category[]> {
    const { data } = await api.get('categories/');
    return data;
}

export async function getStoreConfig(): Promise<StoreConfig> {
    const { data } = await api.get('store/');
    return data;
}

// ─── Ofertas API ───
export interface Oferta {
    id: number;
    nombre: string;
    descripcion: string;
    tipo: 'PCT_OFF' | 'FIXED_PRICE' | 'NXM' | 'COMBO' | 'MIN_AMOUNT';
    valor: string;
    cantidad_requerida: number;
    cantidad_bonificada: number;
    monto_minimo: string;
    fecha_inicio: string;
    fecha_fin: string;
    activa: boolean;
    aplica_a_todo: boolean;
    productos?: number[];
    imagen_banner: string | null;
    color_badge: string;
    visible_catalogo: boolean;
    combo_items: Array<{ id: number; producto: number; producto_nombre: string; cantidad: string }>;
}

export async function getActiveOffers(): Promise<Oferta[]> {
    try {
        const { data } = await api.get('/ofertas/vigentes/');
        return data;
    } catch (e) {
        console.warn("No se pudieron cargar las ofertas vigentes", e);
        return [];
    }
}

export async function createOrder(payload: CreateOrderPayload): Promise<OrderResponse> {
    const { data } = await api.post('orders/', payload);
    return data;
}

export async function getUserOrders(phone: string): Promise<OrderResponse['order'][]> {
    const { data } = await api.get('orders/', { params: { phone } });
    return data;
}

export async function getPaymentMethods(): Promise<Array<{ id: string, name: string }>> {
    const { data } = await api.get('payment-methods/');
    return data;
}

export async function searchClientsPublic(q: string): Promise<Array<{ id: number, name: string, phone: string }>> {
    if (!q || q.length < 3) return [];
    const { data } = await api.get('clients/search/', { params: { q } });
    return data;
}

export async function registerClientPublic(name: string, phone: string): Promise<{ id: number, name: string, phone: string }> {
    const { data } = await api.post('clients/register/', { name, phone });
    return data;
}

// ─── Auth API Functions ──────────────────────
export async function requestOTP(phone: string, email?: string, name?: string): Promise<OTPRequestResponse> {
    const { data } = await api.post('auth/request-otp/', { phone, email, name });
    return data;
}

export async function verifyOTP(phone: string, code: string, name?: string, email?: string): Promise<OTPVerifyResponse> {
    const { data } = await api.post('auth/verify-otp/', { phone, code, name, email });
    return data;
}

export async function getProfile(): Promise<any> {
    const { data } = await api.get('auth/profile/');
    return data;
}

export async function logoutAPI(): Promise<void> {
    await api.post('auth/logout/');
}

export async function loginPassword(phone: string, password: string): Promise<OTPVerifyResponse> {
    const { data } = await api.post('auth/login-password/', { phone, password });
    return data;
}

export async function setPassword(password: string): Promise<{ message: string }> {
    const { data } = await api.post('auth/set-password/', { password });
    return data;
}

export async function registerAPI(name: string, phone: string, email: string, password: string): Promise<OTPVerifyResponse> {
    const { data } = await api.post('auth/register/', { name, phone, email, password });
    return data;
}

export default api;

