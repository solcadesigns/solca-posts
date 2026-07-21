# Qué rompimos exactamente, según sus propias políticas

**20 de julio de 2026** · Fuentes citadas al final. Todo lo que sigue son cláusulas textuales, no interpretación mía.

---

## Brevo: la cláusula que describe nuestro caso

Brevo publica una tabla de situaciones legítimas y no legítimas. Una de ellas es, casi literalmente, lo que hicimos:

> **"Recientemente adquirí una segunda marca. Quiero enviar correos de marketing a los contactos que se suscribieron a mi primera marca, ya que podrían estar interesados."** → 🧐 **No permitido.**
> *"Los contactos que consienten recibir correos de marketing de tu primera marca no necesariamente quieren ni esperan recibir correos de tu segunda marca, porque no aceptaron directamente recibirlos."*

Eso es exactamente el movimiento: gente que se suscribió a **solcaciencia.com** (carreras farmacéuticas) y a tus **libros**, recibiendo correo de **cursospadi.com** (preparación para el EXANI-II). Otra marca, otro tema, otro remitente. El consentimiento no se hereda entre marcas.

**Segunda violación, igual de clara:**

> *"Las listas de contactos que no se han actualizado en los últimos dos años no se consideran conformes, porque los contactos podrían no recordar que se suscribieron."*

Brevo exige que el consentimiento sea **de los últimos dos años**. Parte de esa lista es más vieja.

**Tercera, que agrava:**

> *"Una lista legítima no te autoriza a enviar campañas masivas a todos esos contactos. Segmenta tu base antes de enviar para evitar rebotes duros y blandos, y por lo tanto **la suspensión de tu cuenta**."*

Aun con una lista impecable, el envío masivo de golpe a toda la base es causal de suspensión.

**Lo que Brevo sí acepta, y es nuestra salida:** para contactos de otra marca o antiguos, permite explícitamente *"enviarles un correo uno a uno con un enlace a tu formulario de alta para confirmar su consentimiento"*. Es decir: **el re-opt-in que ya planeamos es el camino que ellos mismos autorizan.**

---

## MailerLite: dos causas posibles, ninguna es "gratis"

**Umbrales automáticos de suspensión:**

| Métrica | Límite |
|---|---|
| Quejas de spam | > 0.2% |
| Rebotes | > 5% |
| Bajas | > 1% |
| **Tasa de apertura** | **< 3%** |

El último es el que casi seguro nos mató: una lista importada, vieja y de otra marca tiene aperturas bajísimas. Ningún otro proveedor que conozca publica un umbral de apertura tan bajo como causal de suspensión inmediata.

**Contenido prohibido, lista textual:** pornografía, **marketing de afiliados y MLM**, apuestas, esquemas de "hágase rico", forex y créditos rápidos, material para bajar de peso, desbloqueo de móviles e IPTV, compraventa de seguidores, compraventa de listas de correo, productos falsificados.

Dos cosas que saltan:

1. **"Marketing de afiliados" está explícitamente prohibido.** Si por **rebeauty.mx** (afiliados de K-beauty) salió algún envío desde esa cuenta, eso solo basta para terminarla.
2. **"Gratis" no aparece en ninguna parte.** Ni "free", ni "gratuito", ni nada equivalente. Revisé la lista completa de contenido prohibido y la política antispam.

Sobre esto último quiero ser directo y sin triunfalismo: tú creíste que fue esa palabra, y era una hipótesis razonable —los filtros de spam sí castigan "gratis" en el asunto—. Pero castigan mandándote a la carpeta de spam, no cerrándote la cuenta. La regla que nos pusimos de evitar "gratis" no hace daño, pero **nos hizo creer que el problema estaba resuelto cuando no lo estaba**, y por eso repetimos el error en Brevo.

---

## ¿Pagar resuelve esto? No.

Respuesta corta: **una cuenta de paga con la misma lista se suspende igual.** Las políticas antispam no distinguen plan gratuito de plan pagado; se aplican a todos. Pagar no compra inmunidad.

Lo que **sí** compra un plan pagado, y no es poco:

- **Soporte humano.** En plan gratuito de MailerLite ni siquiera hay soporte: te mandan al foro de la comunidad. Con plan pagado hay alguien a quien apelar.
- **Revisión antes del cierre**, en vez de suspensión automática y silenciosa.
- **IP dedicada y acompañamiento de calentamiento** en planes altos, que es lo que permite subir volumen sin disparar alarmas.

O sea: pagar te da **un teléfono al cual llamar**, no permiso para saltarte las reglas.

---

## La solución de largo plazo, honestamente

No es un proveedor. Es la práctica de lista. Con estas cuatro reglas cualquier proveedor aguanta; sin ellas, ninguno:

1. **El consentimiento no se hereda entre marcas.** Quien se suscribió a Solca Ciencia no es suscriptor de PADI. Cada marca junta su propia lista.
2. **Doble opt-in siempre**, y que el registro de esa confirmación quede guardado como prueba.
3. **Nunca importar y enviar de golpe.** Si hay que migrar, se migra y se envía por tandas pequeñas y crecientes.
4. **Higiene automática:** rebote duro se purga de inmediato; quien no abre en meses, se deja de contactar.

**La arquitectura que ya diseñamos ejecuta esas cuatro reglas**: la lista vive en Cloudflare KV (nuestra), el doble opt-in lo controlamos nosotros, y el proveedor es una tubería reemplazable. Si un día Resend nos cierra, cambiamos de tubería sin perder nada.

**Sobre el orden de operaciones:** conviene tener PADI enviando limpio y con historial sano antes de tocar la lista vieja de Solca Ciencia. Y cuando la toquemos, será con re-opt-in uno a uno —el camino que Brevo mismo señala como válido—, no con una importación masiva.

---

## Fuentes

- [Brevo — Construir una base de contactos legítima](https://help.brevo.com/hc/en-us/articles/213405965-Build-a-legitimate-contacts-database-for-optimal-deliverability-and-compliance) (la tabla de casos y la regla de los dos años)
- [Brevo — Política antispam](https://www.brevo.com/legal/antispampolicy/)
- [Brevo — Términos de uso](https://www.brevo.com/legal/termsofuse/)
- [MailerLite — Contenido no permitido](https://www.mailerlite.com/help/is-there-any-content-that-mailerlite-doesn-t-allow) (lista textual de prohibidos, actualizada 6 dic 2023)
- [MailerLite — Política antispam](https://www.mailerlite.com/legal/anti-spam-policy) (umbrales de 0.2% / 5% / 1% / 3%)
- [MailerLite — Términos de uso](https://www.mailerlite.com/legal/terms-of-service)
