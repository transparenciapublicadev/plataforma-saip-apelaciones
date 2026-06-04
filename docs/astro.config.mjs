import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

const site = process.env.DOCS_SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  integrations: [
    mermaid({
      theme: 'forest',
      autoTheme: true,
    }),
    starlight({
      title: 'Plataforma SAIP',
      description:
        'Documentación técnica del sistema de gestión de Solicitudes de Acceso a la Información Pública (SAIP) y apelaciones ante el Tribunal de Transparencia (TTAIP) del Perú.',
      defaultLocale: 'es',
      locales: {
        root: {
          label: 'Español',
          lang: 'es',
        },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/plataforma-saip-apelaciones',
        },
      ],
      lastUpdated: true,
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      editLink: {
        baseUrl:
          'https://github.com/plataforma-saip-apelaciones/edit/main/docs/',
      },
      expressiveCode: {
        themes: ['starlight-dark', 'starlight-light'],
      },
      sidebar: [
        {
          label: 'Introducción',
          items: [
            { slug: 'introduccion/descripcion-general' },
            { slug: 'introduccion/contexto-proyecto' },
            { slug: 'introduccion/arquitectura' },
            { slug: 'introduccion/comenzar' },
          ],
        },
        {
          label: 'Backend',
          badge: { text: 'Spring Boot', variant: 'tip' },
          items: [
            { slug: 'backend' },
            { slug: 'backend/arquitectura' },
            { slug: 'backend/entidades' },
            { slug: 'backend/controladores' },
            { slug: 'backend/servicios' },
            { slug: 'backend/seguridad' },
            { slug: 'backend/testing' },
          ],
        },
        {
          label: 'Frontend',
          badge: { text: 'Angular', variant: 'note' },
          items: [
            { slug: 'frontend' },
            { slug: 'frontend/arquitectura' },
            { slug: 'frontend/componentes' },
            { slug: 'frontend/servicios' },
            { slug: 'frontend/rutas-y-guards' },
            { slug: 'frontend/testing' },
          ],
        },
        {
          label: 'Mobile',
          badge: { text: 'Android', variant: 'success' },
          items: [
            { slug: 'mobile' },
            { slug: 'mobile/arquitectura' },
            { slug: 'mobile/navegacion' },
            { slug: 'mobile/viewmodels' },
            { slug: 'mobile/datos-offline' },
            { slug: 'mobile/testing' },
          ],
        },
        {
          label: 'Dominio y Negocio',
          items: [
            { slug: 'dominio/objetivos-negocio' },
            { slug: 'dominio/roles-y-usuarios' },
            { slug: 'dominio/reglas-saip' },
            { slug: 'dominio/reglas-ttaip' },
            { slug: 'dominio/flujo-estados' },
            { slug: 'dominio/glosario' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { slug: 'api/endpoints' },
            { slug: 'api/autenticacion' },
            { slug: 'api/postman' },
            { slug: 'api/codigos-error' },
          ],
        },
        {
          label: 'Despliegue',
          collapsed: true,
          items: [
            { slug: 'despliegue/backend' },
            { slug: 'despliegue/frontend' },
            { slug: 'despliegue/mobile' },
            { slug: 'despliegue/release-readiness' },
          ],
        },
        {
          label: 'Metodología RUP',
          badge: { text: 'Completo', variant: 'success' },
          items: [{ slug: 'metodologia' }],
        },
      ],
    }),
  ],
});

