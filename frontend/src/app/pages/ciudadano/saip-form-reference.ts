// Editorial examples from design-reference/SAIPForm. Never a catalog or server record.
export const PLANTILLA_GENERAL =
`Solicito copia de [tipo de documento: informes, contratos, órdenes de servicio, actas, resoluciones, etc.] sobre [tema concreto], emitidos o elaborados por [área u oficina de la entidad], correspondientes al periodo de [mes y año] a [mes y año].

De ser posible, solicito que la información se entregue en formato [digital (PDF/Excel) / copia simple].`;

// Modelos de ejemplo listos para adaptar.
export const MODELOS = [
  {
    key: 'contrataciones',
    label: 'Contrataciones',
    asunto: 'Copia de órdenes de servicio y de compra [año]',
    texto:
`Solicito copia de las órdenes de servicio y órdenes de compra emitidas por la [Gerencia/Oficina de Logística o Abastecimiento] entre [enero] y [junio] de [2025], incluyendo el nombre del proveedor, el objeto de la contratación y el monto.`,
  },
  {
    key: 'presupuesto',
    label: 'Presupuesto y gastos',
    asunto: 'Reporte de ejecución presupuestal [año]',
    texto:
`Solicito copia del reporte de ejecución presupuestal (PIA, PIM y devengado) de la [unidad ejecutora / área] correspondiente al año [2025], desagregado por [genérica de gasto / proyecto], tal como figura en los registros de la entidad.`,
  },
  {
    key: 'actas',
    label: 'Actas y resoluciones',
    asunto: 'Copia de actas de sesión de [órgano] [año]',
    texto:
`Solicito copia de las actas de las sesiones de [Concejo Municipal / Consejo Directivo / Comité] realizadas entre [mes] y [mes] de [año], y de las resoluciones aprobadas en dichas sesiones.`,
  },
];

// Consejos por paso para el panel "Cómo llenarlo bien".
export const GUIA: Record<number, { tips: string[]; bueno?: string; malo?: string; maloPorQue?: string }> = {
  1: {
    tips: [
      'Pida documentos que ya existen (informes, contratos, actas, resoluciones), no opiniones ni explicaciones.',
      'Sea específico: indique el periodo (meses y año), el área y el tipo de documento.',
      'Una entidad por solicitud. Si necesita información de otra entidad, presente otra solicitud.',
      'No tiene que explicar para qué quiere la información (art. 7 de la Ley N° 27806).',
      'Evite pedir datos personales de otras personas o información secreta, reservada o confidencial (arts. 15 al 17).',
    ],
    bueno: 'Copia de las órdenes de servicio emitidas por la Gerencia de Logística entre enero y junio de 2025.',
    malo: 'Quiero saber en qué gastan la plata.',
    maloPorQue: 'Es muy general, no dice qué documento ni qué periodo. La entidad le pedirá que precise o podría no atenderla.',
  },
  2: {
    tips: [
      'Indique cómo quiere recibir la información: correo electrónico (gratis), copia simple, copia certificada o CD/USB.',
      'Las copias impresas o en CD pueden tener un costo de reproducción según el TUPA de la entidad.',
      'Revise que su correo y datos de contacto estén correctos: allí le llegarán las notificaciones.',
    ],
    bueno: 'Marcar "Correo electrónico" si la información existe en digital (PDF o Excel).',
    malo: 'No marcar ninguna modalidad o elegir varias sin necesitarlas.',
    maloPorQue: 'Sin modalidad la entidad no sabe cómo entregarle la información.',
  },
  3: {
    tips: [
      'Los archivos son opcionales. Úselos solo si ayudan a ubicar la información (por ejemplo, una referencia o número de expediente).',
      'No adjunte documentos con datos personales de otras personas.',
      'Use PDF, JPG, PNG o TXT; ZIP no está admitido por el almacenamiento actual.',
    ],
  },
  4: {
    tips: [
      'Consulte el plazo y las actuaciones registrados por el servidor; no se calculan fechas en este formulario.',
      'Si la entidad solicita una precisión, consulte el requerimiento concreto y sus condiciones de presentación.',
      'Si no le responden a tiempo o le niegan la información, puede apelar ante el Tribunal de Transparencia (TTAIP).',
    ],
  },
};
