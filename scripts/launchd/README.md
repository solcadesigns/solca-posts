# LaunchAgent · señales de Search Console

`com.solca.seosignals.plist` corre `scripts/seo-signals.sh` cada lunes a las 7:00 (hora local de la Mac). Actualiza `_docs/GSC_SIGNALS_LATEST.json` antes de que corra la tarea del blog a las 8:00.

- No toca git ni despliega nada. Solo escribe ese JSON, que está en `.gitignore`.
- `STATS_KEY` se lee de `.dev.vars`, igual que cuando corres el script a mano.
- Log: `~/Library/Logs/solca-seosignals.log`.

## Instalar

```
cp ~/proyectos/solca-ciencia/solca/website/scripts/launchd/com.solca.seosignals.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.solca.seosignals.plist
```

## Probar ahora (sin esperar al lunes)

```
launchctl kickstart -k gui/$(id -u)/com.solca.seosignals
sleep 5
tail -20 ~/Library/Logs/solca-seosignals.log
```

Lo esperado en el log: `ventana: ... → ...` y `Escrito: _docs/GSC_SIGNALS_LATEST.json`.

## Si el log dice "Operation not permitted"

macOS protege la carpeta Descargas. Un proceso lanzado por launchd no recibe el diálogo de permiso, simplemente falla. Solución: Ajustes del Sistema → Privacidad y seguridad → Acceso total al disco → botón + → Cmd+Shift+G → `/bin/bash` → activarlo. Luego repetir la prueba.

## Ver estado

```
launchctl print gui/$(id -u)/com.solca.seosignals | grep -E "state|last exit"
```

`last exit code = 0` significa que la última corrida salió bien.

## Desinstalar

```
launchctl bootout gui/$(id -u)/com.solca.seosignals
rm ~/Library/LaunchAgents/com.solca.seosignals.plist
```
