// Orientation checked against the current citizen forms, receipt reports and validated rules.
// This local guide neither computes deadlines nor certifies an individual proceeding.
export interface RamaItem { label: string; tone: 'ok' | 'warn' | 'bad' | 'info'; text: string; }
export interface JourneyStepItem {
  icon: 'send' | 'file-search' | 'clock' | 'package-check' | 'coins' | 'scale' | 'split' | 'pause-circle' | 'gavel' | 'bell' | 'rotate-ccw';
  accent: string; plazo: string; title: string; desc: string; ramas: RamaItem[];
}
export interface GlosarioGrupo { grupo: string; accent: string; items: { estado: string; desc: string }[]; }
export interface FaqQuestion { id: string; q: string; a: string; }
export interface FaqCategory {
  id: string; title: string; icon: 'file' | 'pen' | 'package' | 'scale' | 'clock' | 'shield';
  accent: string; questions: FaqQuestion[];
}

export const SAIP_JOURNEY: JourneyStepItem[] = [
  { icon: 'send', accent: 'var(--brand-700)', plazo: 'Presentación', title: '1 · Presente su SAIP',
    desc: 'Desde el panel del administrado, indique entidad, asunto, descripción, modalidad y canal de notificación. Revise los consentimientos y conserve el número que devuelva el servidor.', ramas: [] },
  { icon: 'file-search', accent: 'var(--info)', plazo: 'Según requerimiento', title: '2 · Revisión de requisitos',
    desc: 'Consulte el detalle autorizado para conocer las observaciones registradas por la entidad.', ramas: [
      { label: 'Precisión SAIP', tone: 'warn', text: 'Abra el requerimiento concreto desde su solicitud. La precisión requiere un comentario y un archivo; revise la recepción antes de darla por registrada.' },
      { label: 'Fechas del expediente', tone: 'info', text: 'Use las fechas que informa el servidor. Una fecha registrada o un intento de envío no acreditan por sí solos una notificación eficaz.' },
    ] },
  { icon: 'clock', accent: 'var(--brand-700)', plazo: 'Seguimiento', title: '3 · Atención de la solicitud',
    desc: 'El detalle muestra los estados y actuaciones que constan en el servidor, no una estimación del avance.', ramas: [
      { label: 'Ampliación o encauzamiento', tone: 'info', text: 'Revise la actuación y su sustento en el expediente cuando estén disponibles. Esta guía no confirma una derivación, una nueva solicitud ni un cronograma.' },
    ] },
  { icon: 'package-check', accent: 'var(--success)', plazo: 'Registro', title: '4 · Respuesta de la entidad',
    desc: 'La respuesta puede registrarse como total, parcial o denegatoria. Consulte su fundamento y los documentos asociados disponibles.', ramas: [
      { label: 'Registro y entrega', tone: 'info', text: 'Registrar una respuesta no acredita entrega efectiva de información, notificación eficaz, firma ni emisión documental formal.' },
    ] },
  { icon: 'coins', accent: 'var(--gold-dark)', plazo: 'Si corresponde', title: '5 · Reproducción de información',
    desc: 'La presentación de la SAIP es gratuita; puede corresponder un costo de reproducción. Revise la liquidación y las instrucciones de su expediente cuando existan.', ramas: [] },
  { icon: 'scale', accent: 'var(--brand-700)', plazo: 'Según condiciones', title: '6 · Revise la opción de apelar',
    desc: 'Acceda desde la solicitud vinculada o utilice el registro de apelación externa si la SAIP se tramitó fuera de Yaiku. La presentación está sujeta a las condiciones verificadas por el servidor.', ramas: [] },
];

export const APELACION_JOURNEY: JourneyStepItem[] = [
  { icon: 'split', accent: 'var(--brand-700)', plazo: 'Vinculada o externa', title: '1 · Presente la apelación',
    desc: 'Para una SAIP de Yaiku, parta de su detalle. Para una solicitud externa, declare su procedencia y las referencias que exige el formulario; no se crea una SAIP local ficticia.', ramas: [] },
  { icon: 'file-search', accent: 'var(--info)', plazo: 'Calificación', title: '2 · Revisión del recurso',
    desc: 'El TTAIP registra la calificación y, si corresponde, un requerimiento concreto de subsanación.', ramas: [
      { label: 'Subsanación TTAIP', tone: 'warn', text: 'Los fundamentos son obligatorios; los adjuntos son opcionales. Todos los archivos que seleccione deben quedar incluidos en la recepción confirmada.' },
    ] },
  { icon: 'pause-circle', accent: 'var(--gold-dark)', plazo: 'Actuaciones registradas', title: '3 · Instrucción del expediente',
    desc: 'Consulte los descargos, el informe oral o la información complementaria cuando estén registrados. Su existencia no se deduce de la posición del expediente en una lista.', ramas: [] },
  { icon: 'gavel', accent: 'var(--brand-700)', plazo: 'Decisión registrada', title: '4 · Resolución',
    desc: 'Revise el resultado que consta en su apelación. Una previsualización o borrador no es una resolución emitida ni acredita firma digital verificada.', ramas: [] },
  { icon: 'bell', accent: 'var(--info)', plazo: 'Evidencia necesaria', title: '5 · Notificaciones',
    desc: 'Distinga creación, envío técnico y eficacia acreditada de la notificación. Para subsanar, el reloj corresponde al requerimiento y recurrente concretos; puede estar pendiente de inicio.', ramas: [] },
  { icon: 'rotate-ccw', accent: 'var(--success)', plazo: 'Seguimiento separado', title: '6 · Cumplimiento',
    desc: 'El seguimiento de cumplimiento es distinto de la subsanación. Consulte las actuaciones registradas; no se garantiza una reiteración ni un procedimiento disciplinario automático.', ramas: [] },
];

export const GLOSARIO: GlosarioGrupo[] = [
  { grupo: 'Estados de su SAIP', accent: 'var(--brand-700)', items: [
    { estado: 'Recepcionada / En revisión', desc: 'Consta una solicitud registrada o su revisión; consulte los datos de su expediente.' },
    { estado: 'Observada', desc: 'Existe una observación. Revise el requerimiento concreto y la acción de precisión disponible.' },
    { estado: 'En trámite', desc: 'La entidad atiende el pedido; el estado no acredita que ya entregó la información.' },
    { estado: 'Respuesta total / parcial / Denegada', desc: 'Consulte el tipo de respuesta, fundamento y archivos que constan; el registro no certifica entrega o notificación.' },
    { estado: 'Vencida', desc: 'Use el estado y las fechas informados por el servidor, sin deducir un nuevo plazo desde esta guía.' },
    { estado: 'Apelada / Archivada', desc: 'Consulte las actuaciones asociadas. El resumen público no sustituye su detalle autorizado.' },
  ] },
  { grupo: 'Estados de su apelación', accent: 'var(--gold-dark)', items: [
    { estado: 'En primera calificación', desc: 'El Tribunal revisa el recurso. Consulte la calificación registrada.' },
    { estado: 'Inadmisible / En subsanación', desc: 'Revise fundamentos del requerimiento, recepción y reloj acreditado; no significa por sí solo que el plazo empezó.' },
    { estado: 'En segunda calificación', desc: 'El Tribunal revisa la subsanación recibida; presentarla no equivale a su admisión automática.' },
    { estado: 'En resolución', desc: 'Etapa de decisión del recurso; no certifica una resolución emitida o firmada.' },
    { estado: 'Fundado / Fundado en parte', desc: 'Resultado registrado favorable total o parcial. El cumplimiento se consulta de forma separada.' },
    { estado: 'Infundado / Improcedente y otros resultados', desc: 'Lea la decisión y su fundamento en el expediente; esta guía no sustituye la resolución ni su notificación.' },
  ] },
];

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'saip', title: 'Solicitudes SAIP', icon: 'file', accent: 'var(--brand-700)', questions: [
    { id: 'definicion', q: '¿Qué es una solicitud SAIP?', a: 'Es una solicitud de acceso a información pública dirigida a una entidad. En Yaiku, el administrado puede presentar el pedido desde su panel y consultar el expediente que le corresponde.' },
    { id: 'presentacion', q: '¿Cómo presento una solicitud SAIP?', a: 'Ingrese con el acceso del administrado, abra Nueva SAIP y complete entidad, asunto, descripción, modalidad y canal de notificación. Revise los consentimientos antes de enviar. Conserve el identificador confirmado por el servidor.' },
    { id: 'archivos-alta', q: '¿Qué ocurre con los archivos de una nueva SAIP?', a: 'El registro de la solicitud y la subida de sus anexos son operaciones separadas en el alta actual. Revise los mensajes de cada subida y los documentos recuperados; registrar la SAIP no garantiza que todos sus anexos se hayan almacenado.' },
    { id: 'costos', q: '¿Cuánto cuesta presentar una SAIP?', a: 'La presentación es gratuita. Puede corresponder un costo de reproducción; esta guía no calcula tarifas ni confirma pagos. Consulte la liquidación de su expediente cuando esté disponible.' },
  ] },
  { id: 'subsanacion', title: 'Observación y subsanación', icon: 'pen', accent: 'var(--warning)', questions: [
    { id: 'precision', q: '¿Cómo atiendo una precisión SAIP?', a: 'Abra la observación vigente desde el detalle de su solicitud. Escriba un comentario de hasta 3000 caracteres y seleccione un archivo requerido. Solo la recepción confirmada del requerimiento correcto acredita el registro de esa precisión.' },
    { id: 'ttaip', q: '¿Qué necesito para subsanar ante el TTAIP?', a: 'Abra el requerimiento concreto de su apelación y complete los fundamentos obligatorios. Los adjuntos son opcionales; si selecciona varios, todos forman parte de la recepción. No se deducen anexos obligatorios del texto libre de las observaciones.' },
    { id: 'reloj', q: '¿Qué significa inicio pendiente del plazo de subsanación TTAIP?', a: 'Todavía no consta la evidencia necesaria para acreditar el inicio. No equivale a vencido y por sí solo no impide presentar una subsanación habilitada. La fecha de resolución, la apertura y el envío técnico no sustituyen la notificación eficaz del requerimiento al recurrente.' },
    { id: 'incierto', q: '¿Qué hago si el resultado del envío es incierto?', a: 'En precisión SAIP y subsanación TTAIP, utilice Recuperar recepción antes de repetir el registro. Si se recupera, revise su identificador, requerimiento y documentos. Un cierre de diálogo o un archivo seleccionado no confirman la presentación.' },
    { id: 'memoria', q: '¿Se conserva mi texto y la selección de archivos al salir?', a: 'Los formularios de precisión y subsanación conservan texto y archivos solo en memoria durante el contexto vigente. Al recargar, salir o cambiar de expediente puede tener que escribirlos y seleccionarlos nuevamente. La referencia para recuperar una recepción no conserva los bytes seleccionados.' },
  ] },
  { id: 'respuesta', title: 'Respuesta y entrega', icon: 'package', accent: 'var(--success)', questions: [
    { id: 'registro', q: '¿Una respuesta registrada acredita entrega o notificación?', a: 'No. Consulte tipo, fundamento y documentos reales de la respuesta. Registrar no acredita entrega efectiva de información, notificación eficaz, firma verificada ni emisión formal.' },
    { id: 'documentos', q: '¿Cómo consulto o descargo documentos?', a: 'Ingrese al expediente autorizado y use los archivos registrados que estén disponibles. Un fallo de consulta o descarga no se sustituye por un PDF de ejemplo. La vista previa depende del soporte del navegador y no certifica el documento.' },
    { id: 'borrador', q: '¿Un borrador o una plantilla es un documento oficial emitido?', a: 'No. Una plantilla sirve de modelo y un borrador es una previsualización. Un nombre de archivo, una imagen de firma o un número mostrado localmente no acreditan emisión, firma digital verificada ni copia auténtica.' },
  ] },
  { id: 'apelaciones', title: 'Apelaciones TTAIP', icon: 'scale', accent: 'var(--gold-dark)', questions: [
    { id: 'vinculada', q: '¿Cómo apelo una solicitud registrada en Yaiku?', a: 'Abra el detalle de su SAIP y utilice la acción de apelación cuando esté habilitada. La relación se mantiene con el identificador de esa solicitud; el servidor comprueba las condiciones del recurso.' },
    { id: 'externa', q: '¿Puedo apelar si mi SAIP se tramitó fuera de Yaiku?', a: 'Sí. Desde Nueva apelación, elija el registro externo y complete los datos, fundamentos y referencias declaradas que solicita el formulario. No necesita inventar una solicitud local ni elegir el expediente de otra persona.' },
    { id: 'antecedentes', q: '¿Qué antecedentes reviso antes de apelar?', a: 'Revise la solicitud original y la respuesta, si existe, o el sustento de silencio solicitado por el formulario. Distinga documentos registrados, referencias declaradas y archivos que aún solo están seleccionados. Atienda las validaciones del caso concreto.' },
    { id: 'plazo', q: '¿Qué plazo tengo para presentar una apelación?', a: 'Las fuentes del proyecto conservan una contradicción sobre días calendario o hábiles en la denegatoria expresa. Esta guía no elige una interpretación ni calcula una fecha. Revise las comunicaciones y condiciones de su expediente; no use esta orientación como asesoría legal.' },
  ] },
  { id: 'proceso', title: 'Plazos y seguimiento', icon: 'clock', accent: 'var(--info)', questions: [
    { id: 'publica', q: '¿Qué permite consultar el número de expediente sin sesión?', a: 'Puede consultar el estado de una solicitud SAIP o de una apelación TTAIP con su número completo. El resumen público no muestra el asunto, el contenido ni los documentos. Para verlos, ingrese a Mi panel.' },
    { id: 'privada', q: '¿Dónde veo el detalle de mi solicitud?', a: 'Ingrese al panel del administrado y abra la solicitud que le pertenece. El expediente privado contiene el pedido, las actuaciones y los documentos autorizados disponibles; la consulta pública no lo sustituye.' },
    { id: 'fechas', q: '¿Cómo debo interpretar las fechas y días restantes?', a: 'Use los datos del servidor y distinga información ausente de un plazo pendiente de inicio o vencido. Existen diferencias de cálculo entre consultas pendientes de revisión; esta página no recalcula días ni fija un calendario para resolverlas.' },
    { id: 'cumplimiento', q: '¿El sistema inicia medidas disciplinarias automáticamente?', a: 'No se ofrece esa garantía. Consulte las actuaciones de cumplimiento registradas; esta página no inicia reiteraciones, procesos disciplinarios ni acciones judiciales, y no presenta como completada una actuación que no consta.' },
  ] },
  { id: 'cuenta', title: 'Cuenta y registro', icon: 'shield', accent: 'var(--success)', questions: [
    { id: 'acceso', q: '¿Necesito una cuenta para presentar o ver mi expediente?', a: 'Sí. Use Registro y el acceso del administrado. Los accesos de funcionarios, TTAIP y administración son independientes y conservan sus permisos; esta página pública no permite acceder a expedientes ajenos.' },
    { id: 'password', q: 'Olvidé mi contraseña, ¿qué hago?', a: 'Esta instalación no dispone de restablecimiento de contraseña operativo desde la pantalla de acceso. Tampoco tiene un canal de soporte verificado configurado aquí. No envíe su contraseña por mensajes ni espere un correo de recuperación emitido por esta página.' },
    { id: 'sesion', q: '¿Qué ocurre cuando pulso Salir?', a: 'Salir solicita invalidar la sesión actual y limpia los datos locales. Otras sesiones con un token distinto se conservan. Si falla la red, el cierre local no confirma la invalidación en el servidor; las pestañas que comparten el mismo token comparten su invalidación.' },
  ] },
];
