# Help Desk Helper

*[Read in English](README.md)*

Help Desk Helper es un complemento de Thunderbird para insertar fragmentos de texto predefinidos mientras escribes o respondes un correo. Escribe `/` seguido de unas letras de una etiqueta o nombre (por ejemplo `/greet`), elige un fragmento de la lista y sustituye lo que escribiste.

- Funciona en Thunderbird **128 o posterior** (probado en 140 ESR), en Windows, macOS y Linux.
- La interfaz sigue el idioma de Thunderbird: **español** o **inglés**. Cualquier otro idioma usa el inglés.
- Los fragmentos se guardan localmente en Thunderbird. No se envía nada a ningún sitio.

---

## Instalación

1. Consigue el archivo del complemento, `helpdesk-helper-<versión>.xpi`.
2. En Thunderbird, abre **☰ → Complementos y temas**.
3. Pulsa **⚙ → Instalar complemento desde archivo…**, elige el `.xpi` y confirma.
4. Aparece un botón **Fragmentos** en la barra de herramientas principal.

**Para actualizar**, instala el `.xpi` más reciente de la misma forma. Sustituye a la versión anterior y conserva tus fragmentos.

> Después de instalar o actualizar, abre una ventana de redacción **nueva**. Las ventanas que ya estaban abiertas no reciben el complemento.

## Uso al escribir

| Escribes / pulsas | Qué ocurre |
|---|---|
| `/` + 3 letras al inicio de una palabra, p. ej. `/gre` | Se abre una lista de fragmentos que coinciden |
| Más letras | La lista se reduce |
| ↑ / ↓ | Elegir un fragmento |
| **Intro**, **Tab** o **Espacio** | Insertarlo; `/gre` se sustituye |
| **Esc** | Cerrar la lista y conservar lo escrito |
| **Ctrl+Z** justo después de insertar | Deshacer la inserción; `/gre` vuelve a aparecer |

**Cómo se busca:** primero las etiquetas que empiezan por lo escrito, después los nombres que empiezan por ello, después las etiquetas o nombres que lo contienen. Por último, las coincidencias aproximadas en las que tus letras aparecen en orden, así que `/gret` también encuentra `greeting`. No distingue mayúsculas ni acentos: `/espa` encuentra `español`.

**Cuándo no se activa:** la barra tiene que iniciar una palabra. `y/o` y las direcciones web nunca abren la lista. Si nada coincide, aparece un aviso "Ningún fragmento coincide con…" y Espacio escribe un espacio normal.

**Los correos en texto plano** reciben el fragmento sin formato. Las listas pasan a `- elemento` y los enlaces a `texto <dirección>`.

## Gestionar fragmentos

Pulsa **Fragmentos** en la barra principal. El gestor también se abre desde Complementos → Help Desk Helper → **Opciones**.

- **Nuevo fragmento:** escribe un **nombre**, algunas **etiquetas** y el **texto**.
  - Nombres y etiquetas son una sola palabra: letras y números, con `-` para unir palabras.
    `info-spanish` ✅ · `info spanish` ❌ · `info_spanish` ❌
  - En el campo de etiquetas, pulsa Espacio, Intro o coma después de cada etiqueta. Retroceso quita la última.
  - El editor admite **negrita**, *cursiva*, subrayado, listas con viñetas y numeradas, y enlaces. El texto pegado se limpia automáticamente.
  - **Vista previa en texto plano** muestra cómo se verá el fragmento en correos de texto plano.
- **Ctrl+S** guarda. Se te pregunta antes de salir de un fragmento con cambios sin guardar.
- **Buscar** (arriba a la izquierda) filtra la lista con la misma búsqueda que `/` en los correos.
- **Opciones:**
  - *Activador:* el símbolo que abre la lista. De 1 a 3 símbolos, por defecto `/`; por ejemplo `\` o `;;`.
  - *Letras antes de mostrar la lista:* de 1 a 5, por defecto 3.

## Compartir fragmentos con otros puestos

**En el puesto con el juego principal:** en el gestor, pulsa **Exportar**. Se guarda un archivo `helpdesk-helper-snippets-<fecha>_<hora>.json`.

**En cada puesto de soporte:** en el gestor, pulsa **Importar…** y elige el archivo. Después elige una opción:
- **Combinar:** añade los fragmentos nuevos. Un fragmento local con el **mismo nombre** se sustituye por el importado, y los demás fragmentos del puesto se conservan.
- **Reemplazar todo:** el puesto queda exactamente con los fragmentos del archivo. Antes se exporta automáticamente una copia de seguridad de los anteriores (`helpdesk-helper-backup-….json`).

Un resumen indica cuántos fragmentos se añadieron, actualizaron y omitieron, con el motivo de cada omisión (por ejemplo, un nombre no válido). El texto importado siempre se limpia: se eliminan scripts, imágenes y enlaces inseguros.

En [`examples/starter-snippets.json`](examples/starter-snippets.json) hay un juego listo para usar de textos de soporte en español e inglés.

## Solución de problemas

| Problema | Solución |
|---|---|
| No pasa nada al escribir `/abc` | Abre una ventana de redacción **nueva** tras instalar o actualizar. Comprueba en **Opciones** el activador y el número de letras. |
| La lista nunca muestra un fragmento | Revisa sus etiquetas y nombre en el gestor. La búsqueda empieza por el inicio de etiquetas y nombres. |
| Aparecen dos listas | Hay otro complemento de fragmentos instalado (p. ej. una versión de prueba antigua). Desinstálalo. |
| Al importar dice que el archivo no es válido | Usa un archivo creado con **Exportar** en este complemento. |
| Otros problemas | Complementos → ⚙ → **Depurar complementos** → Help Desk Helper → **Inspeccionar** muestra la consola del complemento. |

La sección para desarrolladores está en el [README en inglés](README.md#for-developers).
