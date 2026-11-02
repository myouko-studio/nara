# Investigación técnica: coincidencias visuales para Nara

**Fecha:** 2 de noviembre de 2026  
**Alcance:** investigación y recomendación de arquitectura, con seguimiento del prototipo técnico local-first. No implementa reconocimiento para producción.

## Resumen ejecutivo

Para reconocer una photocard concreta —no solo imágenes con contenido parecido— Nara necesita más que comparar píxeles o usar un modelo genérico de clasificación. La propuesta es una arquitectura **local-first en dos etapas**:

1. Normalizar la imagen y obtener una región de photocard consistente (encuadre manual inicial; detección automática como mejora posterior).
2. Calcular un embedding visual compacto con un modelo de imagen, y ordenar las photocards registradas por similitud coseno.
3. Confirmar los mejores candidatos con una verificación visual local, por ejemplo, correspondencia geométrica de puntos clave, para reducir falsos positivos cuando dos diseños son parecidos.
4. Calibrar el porcentaje que ve el usuario con ejemplos etiquetados de Nara. La similitud cruda no es una probabilidad.

La inferencia en el dispositivo ofrece privacidad y uso sin conexión, pero un runtime como TFLite u ONNX añade dependencias nativas, tamaño de modelo y trabajo de integración. Una API remota acelera el prototipo y permite cambiar el modelo en servidor, a costa de conexión, latencia, coste recurrente y envío de fotografías. Se recomienda probar ambas rutas con una muestra real antes de fijar el modelo.

## 1. Contexto del proyecto

- `package.json` declara **Expo SDK 58** y React Native 0.88.
- Ya están instalados `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` y `expo-sqlite`.
- `app.json` configura el plugin de ImagePicker y SQLite. La app tiene un destino web declarado, además de iOS y Android.
- No se ha revisado ni cambiado el formato de persistencia de las imágenes en este trabajo. SQLite ya está disponible para guardar metadatos y vectores; las imágenes deberían mantenerse como archivos y guardar referencias/URI, evitando blobs de foto dentro de la base de datos.
- No se encontró una dependencia de inferencia de ML en `package.json`.

La documentación de SDK 58 confirma que ImagePicker permite seleccionar de galería o tomar fotos, ImageManipulator transforma imágenes locales y SQLite persiste datos en el dispositivo. Estas piezas resuelven entrada, preprocesamiento y almacenamiento; **no hacen reconocimiento por sí mismas**.

## 2. Qué hay que reconocer

El objetivo es una búsqueda de instancia: dada una foto nueva, encontrar el registro de **la misma photocard física/diseño**, pese a variaciones de captura. No es lo mismo que clasificar “hay una tarjeta” o “es una photocard de cierto grupo”.

Los principales retos y sus implicaciones:

| Variación | Implicación técnica |
|---|---|
| Recorte/encuadre | Un hash global puede cambiar mucho al quitar bordes. Recortar y alinear la tarjeta reduce el problema; una representación por regiones o puntos clave ayuda ante recortes parciales. |
| Perspectiva/rotación | Conviene corregir orientación y, cuando se detecten esquinas, rectificar la perspectiva antes de extraer características. |
| Iluminación/color | Normalización de brillo/color puede ayudar. Un modelo entrenado con variaciones reales es más fiable que comparar píxeles. |
| Reflejos/brillo especular | Ningún método garantiza recuperar detalles tapados por reflejos. El aprendizaje con aumentos realistas puede hacerlo más tolerante, pero si se oculta la identidad visual, la app debe permitir reintentar la foto. |
| Fondo diferente | La tarjeta debe separarse del fondo mediante un marco/recorte asistido o un detector. Un embedding de la imagen completa puede distraerse por el fondo. |
| Resolución/compresión | Redimensionar a la entrada esperada del modelo suele ser suficiente para embeddings; conservar una copia de más calidad puede ser útil para la verificación final. |
| Diseños casi idénticos | Un embedding semántico puede considerar similares dos tarjetas del mismo álbum. La recuperación debe optimizarse con datos etiquetados de Nara y, si hace falta, incorporar verificación local de detalles. |

No existe una técnica que garantice el reconocimiento bajo todas estas variaciones sin conocer el grado de oclusión, calidad de captura y similitud entre diseños. Es un requisito que debe validarse con un conjunto de pruebas propio.

## 3. Alternativas viables en Expo / React Native

### A. Preprocesamiento y comparación clásica en JavaScript

**Qué incluye:** normalizar tamaño/orientación, hashes perceptuales (pHash/dHash), histograma de color y/o métricas de píxel como SSIM.

- **Expo:** muy sencillo si el procesamiento se hace en JavaScript sobre una imagen reducida. `expo-image-manipulator` ya está en el proyecto para transformaciones.
- **Local:** sí; sin red ni servidor.
- **Ventajas:** poco tamaño añadido, almacenamiento mínimo, respuesta rápida y explicabilidad sencilla.
- **Limitaciones:** hashes y métricas globales degradan con recortes, perspectiva, iluminación y reflejos. Color e histograma son especialmente sensibles a iluminación/fondo. SSIM compara estructura entre imágenes alineadas, no identifica por sí solo el mismo objeto cuando el encuadre cambia.
- **Uso recomendado:** filtro barato inicial, detección de duplicados casi exactos o baseline de evaluación; no como reconocedor principal para los requisitos de Nara.

### B. Características locales y correspondencia geométrica (ORB/OpenCV)

**Qué incluye:** puntos clave/descriptores locales y emparejamiento entre ellos; una prueba geométrica puede descartar coincidencias espurias.

- **Expo:** viable a través de un módulo nativo o integración C/C++; normalmente exige una build nativa propia. No es una capacidad de ImagePicker ni de Expo Go.
- **Local:** sí.
- **Ventajas:** los puntos visibles pueden sobrevivir a recortes moderados, cambios de escala/rotación y cambios de fondo; sirve para verificar que detalles concretos pertenecen a la misma tarjeta. ORB se diseñó como alternativa eficiente a SIFT/SURF.
- **Limitaciones:** una tarjeta lisa, borrosa o tapada por reflejos puede ofrecer pocos puntos; los cambios fuertes de iluminación y perspectiva empeoran los emparejamientos. La integración nativa aumenta el mantenimiento y el tamaño.
- **Uso recomendado:** verificación/re-ranking de los pocos mejores candidatos, no comparación exhaustiva por sí sola.

### C. Embeddings visuales con modelo en el dispositivo

**Qué incluye:** pasar una imagen normalizada por una red de visión para producir un vector numérico; comparar vectores con distancia o similitud.

**Runtimes posibles:**

- **TensorFlow Lite** mediante una integración como `react-native-fast-tflite`.
- **ONNX Runtime** con `onnxruntime-react-native`.
- **Vision / Core ML de Apple:** APIs como `VNFeaturePrintObservation` generan feature prints y permiten comparar distancia, pero son una ruta específica de Apple y requieren una solución Android separada.

- **Expo:** las dos primeras opciones son técnicamente viables en React Native, pero tienen código nativo. Hay que verificar la compatibilidad exacta con SDK 58, la versión de React Native y la librería elegida. En general hacen falta una development build y configuración nativa/config plugin; Expo Go no contiene cualquier módulo nativo arbitrario. El soporte real para web también debe resolverse por separado.
- **Local:** sí; una vez instalado el modelo, la extracción y consulta pueden hacerse sin red.
- **Ventajas:** privacidad, uso offline y posibilidad de generar el vector una vez al registrar una tarjeta y comparar el vector de la nueva foto con los ya guardados.
- **Limitaciones:** tamaño del runtime y modelo; trabajo de preprocesamiento/tensores; consumo de memoria y calor durante inferencia; más esfuerzo de distribución y pruebas en dispositivos distintos. Un modelo generalista puede agrupar “tarjetas parecidas” sin distinguir una tarjeta concreta. Para Nara, se requiere evaluar y probablemente ajustar/entrenar un modelo con ejemplos de photocards.
- **Uso recomendado:** candidato principal de producción si las pruebas demuestran calidad suficiente y el tamaño/velocidad son aceptables en la gama de dispositivos objetivo.

### D. Embeddings o comparación en un servicio externo

**Qué incluye:** enviar la imagen a un backend propio o a una API de embeddings; el servidor extrae el vector y busca candidatos en el índice de la colección.

- **Expo:** el cliente puede usar red estándar, pero el proveedor, credenciales, normalización, índice, cuotas y protección de datos se resuelven en backend. Nunca se debe incluir una clave privada de proveedor en la app.
- **Local:** no para la extracción/remoto; se puede almacenar la colección de forma local, pero el matching requiere conexión salvo que se diseñe una caché/fallback.
- **Ventajas:** modelo y runtime no ocupan el dispositivo; actualización del modelo centralizada; capacidad de cómputo y búsqueda gestionada. Es una ruta rápida para experimentar con modelos sin compilar un runtime móvil.
- **Limitaciones:** latencia y disponibilidad dependen de red; consumo de datos y batería durante la carga; coste por uso/almacenamiento; fotos de usuarios salen del dispositivo y requieren una política clara de consentimiento, retención y borrado. El backend se convierte en dependencia operativa.
- **Ejemplo:** Google Vertex AI ofrece embeddings multimodales que admiten imágenes. El proveedor advierte que el producto escalar entre embeddings es una medida de similitud y no una probabilidad calibrada; además, un embedding genérico no garantiza la identificación de photocards concretas.
- **Uso recomendado:** prototipo comparativo o alternativa cuando se priorice velocidad de iteración sobre offline/privacidad. La app debería hablar con un backend de Nara, no directamente con el proveedor.

## 4. Impacto comparativo

Valoración cualitativa para una búsqueda puntual al registrar una imagen; el resultado real depende del modelo, el dispositivo, la cantidad de registros y la política de imágenes.

| Opción | Batería | Almacenamiento del dispositivo | Rendimiento/latencia | Offline |
|---|---|---|---|---|
| Hashes / métricas JS | Muy bajo en una imagen reducida; sube si se decodifican imágenes grandes repetidamente | Muy bajo; hash por registro | Muy rápido para colecciones pequeñas. Puede producir demasiados falsos negativos ante variaciones fuertes. | Sí |
| ORB / OpenCV nativo | Bajo–medio por extracción; comparar muchos descriptores añade coste | Medio por runtime y descriptores guardados | Rápido con candidatos limitados; coste de integración y compatibilidad alto. | Sí |
| Embedding on-device | Medio durante la inferencia; potencialmente bajo para consulta si los vectores están precalculados | Runtime + modelo, desde varios MB hasta decenas o más según modelo/precisión; vector por tarjeta | Inferencia inicial más costosa que un hash; búsqueda por producto escalar es barata para una colección pequeña. Medir en dispositivos de gama baja. | Sí |
| Servicio remoto | Inferencia fuera del teléfono, pero radio/red y transferencia consumen batería | Poco espacio de modelo en el dispositivo; caché opcional | Incluye subida, cola del servidor e inferencia; variable con conexión y carga del servicio. | No, salvo fallback |

Orden de magnitud para vectores: un embedding de 512 componentes `float32` ocupa **2 KiB por tarjeta** sin contar índices/filas; 10.000 vectores serían aproximadamente 20 MiB. Una cuantización a 8 bits reduciría el vector bruto a ~0,5 KiB por tarjeta, si el modelo y la calidad lo permiten. En la práctica, el peso de imágenes suele superar ampliamente el de los vectores. Redimensionar antes de inferencia también evita reservar memoria para decodificar imágenes originales de muchos megapíxeles.

No se deben presentar estos niveles cualitativos como benchmarks. Deben medirse energía, tiempo p50/p95, memoria máxima, tamaño de build/modelo y precisión en los teléfonos objetivo.

## 5. Cómo obtener una puntuación de similitud

### Embeddings

1. El modelo produce un vector para la imagen nueva y uno por imagen registrada.
2. Normalizar ambos vectores a norma unitaria.
3. Calcular el producto escalar (equivalente a coseno si están normalizados):

   `coseno(a, b) = (a · b) / (||a|| × ||b||)`

4. Ordenar por similitud descendente y devolver los mejores candidatos. Para decenas o cientos/miles de tarjetas, una comparación lineal sobre vectores compactos suele ser simple; un índice especializado solo se justifica al medir una colección mayor.

La puntuación cruda **no significa “probabilidad de que sea la misma tarjeta”**. No usar `coseno × 100` como porcentaje probabilístico ni copiar un umbral de otro modelo. Para una cifra interpretable, recopilar pares positivos (misma photocard fotografiada distinto) y negativos difíciles (photocards distintas pero parecidas), y calibrar la relación entre score y resultados en un conjunto separado de prueba. Hasta validar esa calibración, mostrar “similitud” o niveles (“alta / posible”) y ofrecer “ninguna coincidencia” es más honesto que un porcentaje presentado como certeza.

### Hashes perceptuales

Calcular pHash/dHash para cada imagen y contar bits distintos (distancia de Hamming). Una transformación lineal simple de esa distancia puede dar un porcentaje de parecido de hash, pero tampoco será probabilidad de identidad. Es sensible a recortes y no modela la geometría del objeto.

### Verificación de puntos clave

Emparejar descriptores ORB de la consulta y candidato; comprobar cantidad/calidad de correspondencias y coherencia geométrica (p. ej., transformación/homografía compatible con la superficie de la tarjeta). El resultado sirve como evidencia adicional y reordenamiento, no como una confianza universal; umbrales y score compuesto se calibran con las fotos de Nara.

### Combinación de señales

Una estrategia razonable es usar el embedding para recuperar los mejores `k` candidatos y aplicar después verificación geométrica, además de metadatos disponibles (grupo, miembro, álbum/versión). Un score compuesto solo debe fijarse después de validar pesos y umbrales con datos; no promediar scores de escalas distintas sin calibración.

## 6. Arquitectura recomendada para Nara

### Recomendación

**Pipeline local-first, extracción de embeddings de imagen en el dispositivo y verificación de candidatos.** Empezar con una versión de prueba de un embedding model que pueda convertirse a TFLite u ONNX, y comparar esa alternativa con una API remota antes de decidir el modelo final. La decisión del runtime no debe preceder a una prueba de discriminación entre photocards reales.

Flujo conceptual:

```text
Nueva foto / galería
        ↓
Orientación + encuadre/recorte de la tarjeta
        ↓
Redimensionado y normalización (sin guardar copias innecesarias)
        ↓
Embedding local
        ↓
Ranking por coseno contra vectores registrados
        ↓
Verificación de los mejores candidatos + metadatos
        ↓
Coincidencias ordenadas + “sin coincidencia” cuando no supera validación
```

Al registrar una photocard, extraer el vector una sola vez y asociarlo al registro en SQLite; guardar imágenes como archivos con referencia, no dentro de una fila como blobs. Al comparar, extraer una vez la consulta, calcular el ranking y verificar solo los candidatos superiores. Recalcular embeddings si cambia la versión del modelo y versionar los vectores para evitar mezclar espacios incompatibles.

### Por qué esta ruta

- Cumple mejor privacidad y disponibilidad que una llamada obligatoria a la nube.
- Evita transferir cada foto y evita coste de inferencia por cada búsqueda.
- El coste por consulta permanece razonable al guardar los vectores de la colección y no volver a inferirlos todos.
- El ranking por embedding tolera variaciones visuales más que los hashes, mientras que la verificación local ayuda con falsos positivos entre diseños similares.
- Mantiene abierta una API backend como fallback o herramienta de experimento, sin acoplar la experiencia de la app a un único proveedor.

### Riesgos y límites que deben aceptarse

- La librería/runtime elegidos deben probarse en SDK 58, React Native 0.88, Android e iOS; una integración nativa exige development builds. No se debe asumir compatibilidad de Expo Go.
- Un bundle universal a web no implica automáticamente soporte web de TFLite/Core ML. Si la comparación también debe funcionar en navegador, habrá que diseñar un runtime web separado o declarar otro comportamiento para web.
- Un modelo general puede no ser fino suficiente para distinguir la misma photocard de variantes de impresión/álbum. El dataset propio es un requisito de calidad, no un detalle opcional.
- Reflejos que ocultan la imagen, recortes extremos y una foto desenfocada requieren un estado de “no se puede determinar” o pedir otra captura.
- La detección automática de esquinas de una tarjeta requiere un detector/algoritmo adicional; un marco de alineación guiado en la primera versión reduce complejidad y aumenta consistencia.

## 7. Validación antes de implementación de producción

1. **Dataset representativo:** imágenes de cámara y galería; distintas luces, fondos, ángulos, niveles de reflejo, resoluciones y recortes; incluir pares negativos de photocards del mismo álbum/miembro con diseños parecidos.
2. **Separación sin filtración:** mantener capturas de una misma tarjeta en el mismo grupo de entrenamiento o prueba; no permitir que imágenes casi duplicadas aparezcan a ambos lados.
3. **Comparar candidatos:** pHash baseline, embedding remoto de propósito general y un modelo local; opcionalmente añadir ORB como re-ranking. No asumir precisión sin evaluación.
4. **Métricas de producto:** recall@1/3/5, tasa de falsos positivos, precisión al umbral elegido y cobertura de “sin coincidencia”, además de latencia p50/p95, memoria, consumo y tamaño instalado.
5. **Calibrar la interfaz:** determinar un umbral por modelo/versionado y decidir cuándo mostrar coincidencia segura, posibles coincidencias o ningún resultado.
6. **Prueba de dispositivos:** incluir Android e iPhone de gama baja/media, la versión web si está en alcance y reanudación después de una consulta offline.
7. **Revisar privacidad:** si se prueba API remota, documentar consentimiento, retención, borrado y región de procesamiento antes de usar fotos reales de usuarios.

**Criterio para continuar:** no elegir runtime o proveedor por una demo visual. Primero medir que los casos positivos aparecen en el top-k y que negativos similares no se presentan como identidad segura.

## 8. Prototipo local inicial

Para validar el flujo sin proveedor remoto se eligió **`react-native-fast-tflite` + MobileNetV3 Small Image Embedder de MediaPipe**. El modelo oficial de 224 × 224 genera feature vectors en el dispositivo; el runtime requiere una development build nativa (iOS/Android), por lo que no se ejecuta en Expo Go. El modelo se empaqueta localmente en la app; la inferencia no transmite las fotos ni requiere red.

El prototipo calcula una vez el embedding de las photocards registradas, lo guarda en una tabla SQLite versionada por modelo y, al seleccionar una foto nueva, calcula su vector, compara por coseno y muestra los cinco primeros resultados con el score bruto. El acceso a la pantalla de depuración sólo aparece en desarrollo.

Para probarlo en un dispositivo:

1. Iniciar sesión en Expo con `npx eas-cli@latest login` y registrar el iPhone con `npx eas-cli@latest device:create`.
2. Crear la build iOS interna con `npx eas-cli@latest build --platform ios --profile development`; instalar el enlace resultante en el iPhone. Se requiere una cuenta activa del Apple Developer Program y acceso al equipo que firmará la app.
3. En el ordenador, iniciar Metro con `npx expo start --dev-client` y conectar la app instalada al servidor.
4. Registrar las photocards en esta instalación de Nara. Los datos locales de web/Expo Go no se transfieren automáticamente al iPhone.
5. Abrir la pestaña **Embeddings** en una compilación de desarrollo.
6. Pulsar **Indexar photocards** para calcular y persistir los vectores que falten.
7. Tomar una foto o elegir una imagen de galería y pulsar **Comparar y mostrar top 5**.

Preparación de build en el repositorio:

- `expo-dev-client`, `react-native-fast-tflite` y `react-native-nitro-modules` están instalados; el plugin TFLite se configura en `app.json`.
- `eas.json` incluye el perfil de development con distribución interna.
- `app.json` declara el esquema `nara` y el bundle ID de prototipo `com.myoukostudio.nara.dev`. Hay que comprobar que ese identificador está disponible en el equipo Apple al configurar la firma; si no lo está, sustituirlo por uno único antes de compilar.
- No hacen falta Xcode, macOS ni Android/iOS nativos generados en el repositorio para solicitar la build iOS remota.

### Checklist exacta para la primera prueba real

**Requisitos externos**

- [ ] Membresía activa de Apple Developer Program y acceso al equipo Apple que firmará el bundle ID.
- [ ] Cuenta Expo con acceso al proyecto `myouko-studio/nara` (`npx eas-cli@latest login`).
- [ ] iPhone físico a mano para registrar su UDID antes de crear la build (`npx eas-cli@latest device:create`).
- [ ] iPhone y ordenador en la misma red para conectar la development build a Metro.

**Preparación ya hecha en el repositorio**

- [x] Development client, runtime TFLite y dependencias de inferencia instalados.
- [x] Plugin TFLite incluido en la configuración Expo.
- [x] Perfil EAS `development` con distribución interna en `eas.json`.
- [x] Scheme `nara` y bundle ID provisional `com.myoukostudio.nara.dev`.
- [x] Modelo MobileNetV3 Small empaquetado como asset local de 4,1 MB.
- [x] Tabla SQLite para vectores por photocard y versión del modelo.
- [x] Pantalla de depuración con selección de consulta, indexado y top 5 con score coseno bruto.

**Pasos restantes cuando se cumplan los requisitos externos**

- [ ] Confirmar que `com.myoukostudio.nara.dev` está disponible para ese equipo Apple; cambiarlo en `app.json` si ya está ocupado.
- [ ] Registrar el iPhone con EAS.
- [ ] Ejecutar `npx eas-cli@latest build --platform ios --profile development` y aceptar la configuración de credenciales de firma que solicite EAS.
- [ ] Instalar la build desde el enlace de EAS y conectar la app con `npx expo start --dev-client`.
- [ ] Registrar al menos cinco photocards en esa instalación (datos de Expo Go/web no se copian al iPhone).
- [ ] Indexarlas desde **Embeddings**, tomar/elegir una consulta y revisar el ranking top 5.

Estado funcional: **la ruta de código del prototipo está implementada** para generar embeddings, indexar y persistir vectores en SQLite, recuperar la colección, calcular similitud coseno y ordenar hasta cinco resultados. El typecheck, el lint dirigido (sin errores; una advertencia de estilo preexistente) y el bundle Android pasan.

Esto no equivale todavía a confirmar que el prototipo funciona end-to-end en iOS: no se ha compilado ni ejecutado TFLite en una build nativa de iPhone. La primera prueba real debe confirmar que el modelo carga, que la decodificación/preprocesamiento de la imagen funciona en iOS y que el ranking recupera correctamente photocards reales. Por tanto, las pruebas con datos reales y esa validación nativa siguen pendientes; no es correcto garantizar que solo quede pulsar botones antes de esa primera comprobación.

Límites deliberados del experimento:

- MobileNetV3 Small es un modelo general preentrenado con ImageNet, no ajustado para identificar photocards. El ranking puede agrupar contenido semánticamente parecido en lugar de la misma tarjeta.
- Para el tensor de entrada la imagen se reduce y deforma a 224 × 224; no se detecta ni rectifica automáticamente la tarjeta.
- Los scores son similitud coseno sin calibrar, no porcentajes ni probabilidades.
- Los vectores persistidos usan una versión de modelo; si se sustituye el archivo/modelo, deben regenerarse.
- La validación funcional final requiere ejecutar una development build en un teléfono Android o iOS con una colección real. Typecheck y lint no validan por sí mismos la calidad de reconocimiento.

## 9. Referencias

- [Expo SDK 58: referencia del SDK](https://docs.expo.dev/versions/v58.0.0/)
- [Expo SDK 58: ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/)
- [Expo SDK 58: ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/)
- [Expo SDK 58: SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo SDK 58: FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)
- [Expo: introducción a development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [ONNX Runtime: React Native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html)
- [react-native-fast-tflite: instalación, modelos y delegates](https://github.com/margelo/react-native-fast-tflite)
- [Apple Vision: VNFeaturePrintObservation](https://developer.apple.com/documentation/vision/vnfeatureprintobservation)
- [Apple Vision: computeDistance de feature prints](https://developer.apple.com/documentation/vision/vnfeatureprintobservation/computedistance(_:to:))
- [Google Vertex AI: embeddings multimodales y límites de la similitud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/embeddings/get-multimodal-embeddings)
- [MediaPipe: Image Embedder, formatos y modelos MobileNetV3](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder)
- [MediaPipe: modelo MobileNetV3 Small empaquetado](https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite)
- [OpenCV: ORB y descriptores locales](https://docs.opencv.org/4.x/d1/d89/tutorial_py_orb.html)
