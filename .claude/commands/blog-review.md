---
description: Revisa editorial + antifabricación de un post del blog contra las 5 reglas de Oscar
argument-hint: <slug o ruta al .md>
---

# /blog-review

Revisa el draft o post publicado que el usuario indica, aplicando el skill
`blog-editorial-review` completo (5 reglas editoriales + barrido
antifabricación).

## Cómo usar

```
/blog-review cro-latam-entry-level-icon-iqvia-que-piden-en-realidad
/blog-review src/content/blog/como-ser-msl-en-mexico-perfil-formacion-ruta.md
```

Si no se pasa argumento, revisa el post más reciente en `src/content/blog/`
ordenado por `pubDate` desc.

## Qué hace este comando

1. Resuelve la ruta absoluta del archivo (agrega prefijo `src/content/blog/`
   y sufijo `.md` si el usuario pasó solo un slug).
2. Verifica que el archivo exista; si no, aborta con error claro.
3. Invoca el skill `blog-editorial-review` sobre esa ruta.
4. Aplica los `[FIX SUGERIDO]` que el subagente devuelva.
5. Presenta al usuario los `[BLOQUEO]` que requieren decisión humana.

## Diferencia con el skill

- El **skill** se activa automáticamente en drafts nuevos y ediciones
  sustanciales (dispara solo cuando detecta contexto de blog).
- Este **comando** es invocación manual: útil para auditar posts ya
  publicados o hacer re-review después de cambios.
