# Documentación — Plataforma SAIP

Desde `docs/`, con Node.js 22 y la versión de pnpm indicada en `package.json`:

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

Para generar sitemap canónico al publicar Starlight, definir `DOCS_SITE_URL` antes del build. El fallback local es `http://localhost:4321`.

```powershell
$env:DOCS_SITE_URL='https://docs.misaip.gob.pe'
pnpm run build
```

Esta carpeta contendrá la documentación técnica y funcional del proyecto.

## Estructura planificada

```
docs/
├── architecture/       → Diagramas de arquitectura (C4, componentes, despliegue)
├── api/                → Documentación de la API REST (OpenAPI/Swagger)
├── business-rules/     → Reglas de negocio SAIP y TTAIP documentadas
├── database/           → Esquemas, ERD, migraciones
├── guides/             → Guías de desarrollo, onboarding, despliegue
└── requirements/       → Especificación de requisitos funcionales (SRS)
```

> **Nota**: Esta carpeta está en fase de planificación. La documentación se irá agregando progresivamente.
