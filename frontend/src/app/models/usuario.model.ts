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
    nombreCompleto?: string;
    dni?: string;
    tipoPersona?: 'NATURAL' | 'JURIDICA';
    ruc?: string;
    razonSocial?: string;
    representanteDni?: string;
    representanteNombreCompleto?: string;
    ciudadanoId?: number;
    funcionarioId?: number;
    entidadId?: number;
    entidadNombre?: string;
    miembroId?: number;
    administradorId?: number;
    redirectUrl?: string;
}

export interface RegistroRequest {
    email: string;
    password: string;
    tipoPersona?: 'NATURAL' | 'JURIDICA';
    dni?: string;
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    nombreCompleto?: string;
    ruc?: string;
    razonSocial?: string;
    representanteDni?: string;
    representanteNombreCompleto?: string;
    telefono?: string;
    ubigeo?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    tipoVia?: string;
    nombreVia?: string;
    numero?: string;
    interior?: string;
    referencia?: string;
    direccion?: string;
}

export interface RegistroResponse {
    success: boolean;
    mensaje?: string;
    ciudadanoId?: number;
    email?: string;
}
