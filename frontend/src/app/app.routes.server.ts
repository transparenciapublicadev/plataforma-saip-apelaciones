import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth pages (depend on localStorage)
  {
    path: 'login',
    renderMode: RenderMode.Client
  },
  {
    path: 'registro',
    renderMode: RenderMode.Client
  },
  // Ciudadano routes (auth-protected)
  {
    path: 'ciudadano',
    renderMode: RenderMode.Client
  },
  {
    path: 'ciudadano/nueva-saip',
    renderMode: RenderMode.Client
  },
  {
    path: 'ciudadano/nueva-apelacion',
    renderMode: RenderMode.Client
  },
  {
    path: 'ciudadano/solicitud/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ciudadano/apelacion/nueva/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ciudadano/subsanacion/:expediente',
    renderMode: RenderMode.Client
  },
  // Funcionario routes (auth-protected)
  {
    path: 'funcionario',
    renderMode: RenderMode.Client
  },
  {
    path: 'funcionario/solicitud/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'funcionario/responder/:expediente',
    renderMode: RenderMode.Client
  },
  // TTAIP routes (auth-protected)
  {
    path: 'ttaip',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/calificar/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/segunda-calificacion/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/apelacion/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/resolucion/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/resolver/:expediente',
    renderMode: RenderMode.Client
  },
  {
    path: 'ttaip/procesos-disciplinarios',
    renderMode: RenderMode.Client
  },
  // Admin routes (auth-protected)
  {
    path: 'admin',
    renderMode: RenderMode.Client
  },
  // Public routes (home, etc.)
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
