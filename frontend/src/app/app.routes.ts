import { Routes } from '@angular/router';
import { authGuard, tipoUsuarioGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Yaiku — Inicio | Plataforma Integral SAIP y Apelaciones',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    title: 'Iniciar sesión | Yaiku',
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent),
    data: { accessMode: 'citizen' }
  },
  {
    path: 'acceso-funcionario',
    title: 'Acceso institucional — Funcionario | Yaiku',
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent),
    data: { accessMode: 'internal', requiredRole: 'FUNCIONARIO' }
  },
  {
    path: 'acceso-ttaip',
    title: 'Acceso institucional — Tribunal TTAIP | Yaiku',
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent),
    data: { accessMode: 'internal', requiredRole: 'TTAIP' }
  },
  {
    path: 'acceso-admin',
    title: 'Acceso institucional — Administrador | Yaiku',
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent),
    data: { accessMode: 'internal', requiredRole: 'ADMINISTRADOR' }
  },
  {
    path: 'registro',
    title: 'Registro de administrado | Yaiku',
    loadComponent: () => import('./pages/auth/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'consultar',
    title: 'Consultar estado de solicitud | Yaiku',
    loadComponent: () => import('./pages/public/consultar.component').then(m => m.ConsultarComponent)
  },
  {
    path: 'ayuda',
    title: 'Centro de ayuda y orientación | Yaiku',
    loadComponent: () => import('./pages/public/ayuda.component').then(m => m.AyudaComponent)
  },
  {
    path: 'documentacion',
    title: 'Documentación | Yaiku',
    data: { infoPage: 'documentacion' },
    loadComponent: () => import('./pages/public/info-pages.component').then(m => m.InfoPagesComponent)
  },
  {
    path: 'acerca',
    title: 'Acerca de Yaiku',
    data: { infoPage: 'acerca' },
    loadComponent: () => import('./pages/public/info-pages.component').then(m => m.InfoPagesComponent)
  },
  {
    path: 'ciudadano',
    title: 'Mi espacio ciudadano | Yaiku',
    loadComponent: () => import('./pages/ciudadano/ciudadano-dashboard.component').then(m => m.CiudadanoDashboardComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/nueva-saip',
    title: 'Nueva solicitud SAIP | Yaiku',
    loadComponent: () => import('./pages/ciudadano/nueva-saip.component').then(m => m.NuevaSaipComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/borradores',
    title: 'Borradores de solicitud | Yaiku',
    loadComponent: () => import('./pages/ciudadano/borradores-saip.component').then(m => m.BorradoresSaipComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/solicitud/:expediente',
    title: 'Detalle de solicitud | Yaiku',
    loadComponent: () => import('./pages/ciudadano/solicitud-detalle.component').then(m => m.SolicitudDetalleComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/tribunal',
    title: 'Actuaciones del Tribunal | Yaiku',
    loadComponent: () => import('./pages/tribunal/comunicaciones-tribunal.component').then(m => m.ComunicacionesTribunalComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/nueva-apelacion',
    title: 'Nueva apelación TTAIP | Yaiku',
    loadComponent: () => import('./pages/ciudadano/nueva-apelacion.component').then(m => m.NuevaApelacionComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/apelacion/nueva/:expediente',
    title: 'Nueva apelación TTAIP | Yaiku',
    loadComponent: () => import('./pages/ciudadano/nueva-apelacion.component').then(m => m.NuevaApelacionComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/subsanacion/:expediente',
    title: 'Subsanación de apelación | Yaiku',
    loadComponent: () => import('./pages/ciudadano/subsanacion.component').then(m => m.SubsanacionComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'ciudadano/precision/:expediente',
    title: 'Aclaración de solicitud | Yaiku',
    loadComponent: () => import('./pages/ciudadano/precision-form.component').then(m => m.PrecisionFormComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'precision-form/:expediente',
    title: 'Aclaración de solicitud | Yaiku',
    loadComponent: () => import('./pages/ciudadano/precision-form.component').then(m => m.PrecisionFormComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'precision-form',
    title: 'Aclaración de solicitud | Yaiku',
    loadComponent: () => import('./pages/ciudadano/precision-form.component').then(m => m.PrecisionFormComponent),
    canActivate: [tipoUsuarioGuard('CIUDADANO')]
  },
  {
    path: 'funcionario',
    title: 'Bandeja de solicitudes | Yaiku Funcionario',
    loadComponent: () => import('./pages/funcionario/funcionario-dashboard.component').then(m => m.FuncionarioDashboardComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')]
  },
  {
    path: 'funcionario/solicitud/:expediente',
    title: 'Atención de solicitud | Yaiku Funcionario',
    loadComponent: () => import('./pages/funcionario/funcionario-solicitud-detalle.component').then(m => m.FuncionarioSolicitudDetalleComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')]
  },
  {
    path: 'funcionario/responder/:expediente',
    title: 'Responder solicitud | Yaiku Funcionario',
    loadComponent: () => import('./pages/funcionario/funcionario-responder.component').then(m => m.FuncionarioResponderComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')]
  },
  {
    path: 'funcionario/apelaciones/:expediente',
    title: 'Expediente de apelación | Yaiku Funcionario',
    loadComponent: () => import('./pages/ttaip/ttaip-resolucion-detalle.component').then(m => m.TtaipResolucionDetalleComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')]
  },
  {
    path: 'funcionario/tribunal',
    title: 'Actuaciones del Tribunal | Yaiku Funcionario',
    loadComponent: () => import('./pages/tribunal/comunicaciones-tribunal.component').then(m => m.ComunicacionesTribunalComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')],
    data: { entidad: true }
  },
  {
    path: 'funcionario/reportes',
    title: 'Reportes ANTAIP | Yaiku Funcionario',
    loadComponent: () => import('./pages/reportes/reportes-institucionales.component').then(m => m.ReportesInstitucionalesComponent),
    canActivate: [tipoUsuarioGuard('FUNCIONARIO')],
    data: { reportMode: 'entidad', tipos: ['FUNCIONARIO'], title: 'Reportes ANTAIP' }
  },
  {
    path: 'ttaip',
    title: 'Bandeja de apelaciones | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-dashboard.component').then(m => m.TtaipDashboardComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/calificar/:expediente',
    title: 'Calificación de admisibilidad | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-calificar.component').then(m => m.TtaipCalificarComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/segunda-calificacion/:expediente',
    title: 'Segunda calificación | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-segunda-calificacion.component').then(m => m.TtaipSegundaCalificacionComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/resolver/:expediente',
    title: 'Resolución de apelación | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-resolver.component').then(m => m.TtaipResolverComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/apelacion/:expediente',
    title: 'Expediente de apelación | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-resolucion-detalle.component').then(m => m.TtaipResolucionDetalleComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/resolucion/:expediente',
    title: 'Resolución de apelación | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/ttaip-resolucion-detalle.component').then(m => m.TtaipResolucionDetalleComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/procesos-disciplinarios',
    title: 'Procesos disciplinarios | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/proceso-disciplinario.component').then(m => m.ProcesoDisciplinarioComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/cumplimiento',
    title: 'Seguimiento de cumplimiento | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/compliance-tracking.component').then(m => m.ComplianceTrackingComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/compliance',
    title: 'Seguimiento de cumplimiento | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/compliance-tracking.component').then(m => m.ComplianceTrackingComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')]
  },
  {
    path: 'ttaip/reportes',
    title: 'Reportes ANTAIP | Yaiku Tribunal',
    loadComponent: () => import('./pages/reportes/reportes-institucionales.component').then(m => m.ReportesInstitucionalesComponent),
    canActivate: [tipoUsuarioGuard('TTAIP')],
    data: { reportMode: 'ttaip', tipos: ['TTAIP'], title: 'Reportes ANTAIP' }
  },
  {
    path: 'compliance',
    title: 'Seguimiento de cumplimiento | Yaiku Tribunal',
    loadComponent: () => import('./pages/ttaip/compliance-tracking.component').then(m => m.ComplianceTrackingComponent),
    canActivate: [tipoUsuarioGuard('TTAIP', 'ADMINISTRADOR')]
  },
  {
    path: 'admin',
    title: 'Panel de administración | Yaiku',
    loadComponent: () => import('./pages/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [tipoUsuarioGuard('ADMINISTRADOR')]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
