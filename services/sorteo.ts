import api from './api';

export interface SorteoActivo {
    id: number;
    nombre: string;
    descripcion: string;
    premio: string;
    compra_minima: string;
    fecha_fin: string;
}

export async function getSorteoActivo(): Promise<SorteoActivo | null> {
    try {
        const res = await api.get('sorteo/');
        return res.data || null;
    } catch {
        return null;
    }
}

export async function participarSorteo(data: {
    nombre: string;
    telefono: string;
    order_id: number;
}): Promise<{ ok?: boolean; ya_inscripto?: boolean; mensaje?: string; error?: string }> {
    const res = await api.post('sorteo/participar/', data);
    return res.data;
}
