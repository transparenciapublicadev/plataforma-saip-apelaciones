// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { LoginRequestDTO, RegistroRequestDTO } from '../api/types';

// Usuario no tiene DTO en el spec (es transversal a los roles)
export interface Usuario {
    id: number;
    email: string;
    tipoUsuario: 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
    activo: boolean;
}

export type LoginRequest = LoginRequestDTO;

// Respuestas de auth — el backend retorna Map<String,Object>, tipamos aquí
export interface LoginResponse {
    success: boolean;
    mensaje?: string;
    token?: string;
    usuarioId?: number;
    email?: string;
    tipoUsuario?: string;
    nombre?: string;
    dni?: string;
    ciudadanoId?: number;
    funcionarioId?: number;
    entidadId?: number;
    entidadNombre?: string;
    miembroId?: number;
    administradorId?: number;
    redirectUrl?: string;
}

export type RegistroRequest = RegistroRequestDTO;

export interface RegistroResponse {
    success: boolean;
    mensaje?: string;
    ciudadanoId?: number;
    email?: string;
}
