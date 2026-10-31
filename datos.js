// Datos iniciales y plantillas. Lo que Sandra cambie se guarda en su celular, no aquí.

// Conexión con Google Drive (respaldo automático y sincronizar aparatos). Se llena con el ID de cliente de Google de Sergio.
const GOOGLE_CLIENT_ID = "623553187-6fbdpsp6jqio2h7639os0mk7k3qib3vg.apps.googleusercontent.com";

// Oficinas de Padrón y Licencias. Datos públicos de cada municipio (oct 2026); confirmar por teléfono antes de ir.
const MUNICIPIOS_INICIALES = [
  { nombre: "Tlaquepaque", oficina: "Dirección de Padrón y Licencias, Niños Héroes 360, Col. El Álamo", telefono: "33 3837 0361 (conmutador 33 1057 6000)", pagina: "https://www.tlaquepaque.gob.mx", formato: "https://www.tlaquepaque.gob.mx" },
  { nombre: "Guadalajara", oficina: "Dirección de Padrón y Licencias, 5 de Febrero 249 (Unidad Administrativa Reforma)", telefono: "33 3669 1300", pagina: "https://visorurbano.guadalajara.gob.mx", formato: "https://transparencia.guadalajara.gob.mx/sites/default/files/Costo_Licencia_Giro_Tipo_A_y_B.pdf" },
  { nombre: "Zapopan", oficina: "Dirección de Padrón y Licencias", telefono: "33 3818 2200", pagina: "https://vdigital.zapopan.gob.mx", formato: "https://retys.zapopan.gob.mx/tramites/355/formato" },
  { nombre: "Tlajomulco", oficina: "Dirección de Padrón y Licencias", telefono: "33 3283 4400 (conmutador)", pagina: "https://padronylicencias.tlajomulco.gob.mx", formato: "https://padronylicencias.tlajomulco.gob.mx" },
];

const PLAZAS_INICIALES = [
  // Direcciones como dicen los contratos firmados (decisión de Sergio, 31 oct 2026).
  // Tesoro está en Tlaquepaque; Zapopan es donde se firmaron algunos contratos (Sergio, 31 oct 2026).
  { id: "TES", municipio: "Tlaquepaque", nombre: "Tesoro", direccion: "Vista a la Campiña Tuxtla, Prolongación Av. Las Fuentes 2846, Col. Paisajes del Tesoro, C.P. 45608, Tlaquepaque, Jal." },
  { id: "CRE", municipio: "Tlaquepaque", nombre: "Camino Real", direccion: "Av. Antiguo Camino Real a Colima, Col. La Candelaria, Santa Anita, Tlaquepaque, Jal." },
  { id: "CAN", municipio: "Tlaquepaque", nombre: "La Candelaria", direccion: "Av. Virgen de la Candelaria, Col. La Candelaria, Santa Anita, Tlaquepaque, Jal." },
  { id: "STM", municipio: "Tlaquepaque", nombre: "Sta. María", direccion: "Prolongación Colón 6102, Col. Santa María Tequepexpan, C.P. 45601, Tlaquepaque, Jal." },
  { id: "BAZ", municipio: "Tlaquepaque", nombre: "Bazar Sur", direccion: "Cerca de Colón 1000, Santa María Tequepexpan, 45601 San Pedro Tlaquepaque, Jal." },
  { id: "VAR", municipio: "Guadalajara", nombre: "Plaza Variedades", direccion: "Av. Juárez 165, Plaza Variedades, Col. Centro, Guadalajara, Jal." },
  { id: "LMT", municipio: "Zapopan", nombre: "López Mateos", direccion: "Plaza Comercial Sur VIP, Av. Adolfo López Mateos Sur 2043, El Mante, 45235 Zapopan, Jal." },
];

// [plaza, número, nivel, giro, estado]
const LOCALES_INICIALES = [
  ["TES", "2846", "Planta baja", "Minisúper", "rentado"],
  ["TES", "2846-1", "Planta baja", "Venta de alimentos (chilaquiles)", "rentado"],
  ["TES", "2846-2", "Planta baja", "Venta de alimentos (cocina)", "rentado"],
  ["TES", "2846-3", "1er nivel", "Mariscos", "rentado"],
  ["TES", "2846-4", "1er nivel", "", "vacio"],
  ["TES", "2846-5", "1er nivel", "Brunchies", "rentado"],
  ["TES", "2846-6", "2do nivel", "Agencia de marketing digital", "rentado"],
  ["TES", "2846-7", "2do nivel", "Estética spa", "rentado"],
  ["TES", "2846-8", "2do nivel", "Ramen", "rentado"],
  ["CRE", "161", "Planta baja", "Vinos y licores", "rentado"],
  ["CRE", "161-A", "Planta baja", "Electrodomésticos", "rentado"],
  ["CRE", "161-B", "Planta baja", "Decoración de eventos", "rentado"],
  ["CRE", "159", "1er nivel", "Seguridad privada", "rentado"],
  ["CRE", "159-A", "1er nivel", "Consultorio y estética canina", "rentado"],
  ["CRE", "159-B", "1er nivel", "Paneles solares", "rentado"],
  ["CAN", "157", "1er nivel", "Carpintería", "rentado"],
  ["CAN", "159", "1er nivel", "Estética", "rentado"],
  ["CAN", "161", "1er nivel", "Abarrotes", "rentado"],
  ["CAN", "163", "1er nivel", "Insumos para fiesta", "rentado"],
  ["CAN", "544", "1er nivel", "Purificadora de agua", "rentado"],
  ["CAN", "Sin número", "1er nivel", "", "rentado"],
  ["STM", "6102", "Planta baja", "Ferretería", "rentado"],
  ["STM", "6102-B", "1er nivel", "Almacén ferretero", "rentado"],
  ["BAZ", "Local", "", "", "venta"],
  ["VAR", "124-B", "", "Venta de ropa", "rentado"],
  ["VAR", "125-B", "", "Venta de ropa", "rentado"],
  ["LMT", "Local 1", "Planta baja", "", "entrega"],
  ["LMT", "Local 2", "Planta baja", "", "entrega"],
];

const DOCS_EXPEDIENTE = [
  { id: "ineInq", nombre: "INE del inquilino", foto: true, vigencia: true },
  { id: "compInq", nombre: "Comprobante de domicilio del inquilino", foto: true, fecha: true },
  { id: "ineFia", nombre: "INE del fiador", foto: true, vigencia: true },
  { id: "compFia", nombre: "Comprobante de domicilio del fiador", foto: true, fecha: true },
  { id: "pagRenta", nombre: "Pagaré por un mes de renta", foto: true },
  { id: "pagDep", nombre: "Pagaré por un mes de depósito", foto: true },
  { id: "contrato", nombre: "Contrato firmado", foto: true },
  { id: "licencia", nombre: "Docs para su licencia entregados", foto: false },
];

const DOCS_LICENCIA_ANTERIOR =
  "Copia del contrato de arrendamiento firmado\nCopia de identificación de la arrendadora\nCopia del último recibo de predial del inmueble\nDirección completa y número del local\n(Confirma en ventanilla del municipio si piden algo más)";
const DOCS_LICENCIA_TEXTO =
  "Contrato de arrendamiento firmado\nINE de la propietaria\nTu INE y tu comprobante de domicilio\n3 fotos del local: frente y los dos costados, donde se vean los vecinos\nFormato de pago de licencia del municipio (link abajo)";

const AJUSTES_INICIALES = {
  arrendador: "Sandra Velasco Soto",
  propietarias: "Sandra Velasco Soto | ",
  telefono: "",
  ciudadFirma: "San Pedro Tlaquepaque",
  gracia: 5,
  avisoRenovacion: 60,
  respuestaRenovacion: 30,
  diasLuz: 65,
  inflacion: 0,
  recargoPct: 10,
  interesPagare: "10",
  mesesContrato: 12,
  docsLicencia: DOCS_LICENCIA_TEXTO,
};

const TEXTO_REQUISITOS =
  "Hola, para preparar tu contrato del local necesito que me mandes por aquí foto clara de:\n\n" +
  "*Inquilino*\n• INE vigente (por ambos lados)\n• Comprobante de domicilio no mayor a 3 meses\n• Nombre completo, correo y giro del negocio\n\n" +
  "*Fiador solidario*\n• INE vigente (por ambos lados)\n• Comprobante de domicilio no mayor a 3 meses\n\n" +
  "*Al firmar*\n• Pagaré por un mes de renta\n• Pagaré por un mes de depósito\n• Pago del primer mes y del depósito\n\nGracias.";

// Contrato provisional anterior: si un celular lo tiene, se cambia por el de los contratos firmados.
const INICIO_PLANTILLA_PROVISIONAL = "CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL\n\nEn {CIUDAD}, Jalisco, a {FECHA}, celebran";

// Contrato modelo: el mismo texto de los contratos firmados de Sandra (2026). Se edita en Ajustes > Contrato.
const PLANTILLA_CONTRATO = `CONTRATO DE ARRENDAMIENTO

En la Ciudad de Guadalajara, Jalisco, a {FECHA}, comparecieron: Por una parte, {ARRENDADOR}, a quien en lo sucesivo se le denominará como "LA PARTE ARRENDADORA". Por otra parte, {INQUILINO}, a quien en lo sucesivo se le denominará como "LA PARTE ARRENDATARIA". Por última parte {FIADOR}, a quien en lo sucesivo se le denominará como "LA PARTE FIADORA". Los comparecientes dijeron que tienen celebrado UN CONTRATO DE ARRENDAMIENTO, el cual sujetan a las siguientes:

CLÁUSULAS

PRIMERA.- "LA PARTE ARRENDADORA" entrega en arrendamiento y "LA PARTE ARRENDATARIA" recibe en tal concepto y en las condiciones en que se encuentra, y a su entera satisfacción, EL {LOCAL_DESCRIPCION}, con la superficie, medidas y linderos especificados en la escritura de propiedad correspondiente, los cuales se tienen por aquí reproducidos íntegramente como si se transcribiesen a la letra para todos los efectos legales a que haya lugar, obligándose "LA PARTE ARRENDATARIA" a destinar su uso única y exclusivamente para {GIRO}. Así mismo manifiestan ambas partes que "LA PARTE ARRENDATARIA" autoriza a "LA PARTE ARRENDADORA" para que le conceda a ésta el ingreso al bien inmueble arrendado en el tiempo en que se lo requiera, a fin de poder realizar una revisión del estado de conservación del mismo.

SEGUNDA.- Los contratantes pactan de común acuerdo que "LA PARTE ARRENDATARIA" pagará a "LA PARTE ARRENDADORA" por concepto de renta, respecto del inmueble arrendado, la cantidad de {RENTA}{IVA} ({RENTA_LETRA}) mensuales, dichas cantidades se deberán cubrir mediante pagos anticipados entregados directamente a "LA PARTE ARRENDADORA" {DIA_PAGO_TEXTO}, en el inmueble objeto de este contrato o bajo acuerdo de cualquier lugar de entrega.

TERCERA.- Los contratantes pactan de común acuerdo que el término de la duración del presente contrato será de {DURACION}, comenzando a surtir sus efectos el día {INICIO} y terminando el día {FIN}, por lo tanto en la fecha de vencimiento se obliga "LA PARTE ARRENDATARIA" a devolver a "LA PARTE ARRENDADORA" la posesión del bien inmueble objeto de este contrato, junto con sus frutos, mejoras y accesiones que en su caso llegue a tener, renunciando expresamente "LA PARTE ARRENDATARIA" al derecho de prórroga establecido por el artículo 2043 dos mil cuarenta y tres del Código Civil para el Estado de Jalisco en vigor, y manifestando expresamente que lo establecido por el artículo 2044 dos mil cuarenta y cuatro de dicho ordenamiento legal antes citado no será aplicable al presente contrato.
Cualquier solicitud de renovación deberá ser presentada por escrito con {AVISO} días de anticipación y la decisión final de renovar o no el presente contrato será por cuenta de "LA PARTE ARRENDADORA", quien se obliga a responder a "LA PARTE ARRENDATARIA" por escrito en un plazo no menor de {RESPUESTA} días anteriores al vencimiento del presente contrato.
En el supuesto de que "LA PARTE ARRENDATARIA" desocupara antes del término pactado en el presente contrato, se obliga a pagar a "LA PARTE ARRENDADORA" la cantidad equivalente a dos meses de renta, así como a entregar el local pintado de blanco y sin modificaciones de ningún tipo. En caso de que el local sea entregado en condiciones diferentes, el depósito dejado en garantía se utilizará para devolver el local a las condiciones antes mencionadas.

CUARTA.- Los contratantes pactan que si al finalizar el presente contrato "LA PARTE ARRENDATARIA" no desocupa el inmueble arrendado y no lo entrega a "LA PARTE ARRENDADORA" en el plazo establecido, esto dará motivo para que se le aplique una pena equivalente al 95% noventa y cinco por ciento de la renta mensual, hasta la desocupación y entrega del inmueble arrendado. Esta pena se hará efectiva por el solo retraso en la entrega del bien arrendado, de conformidad con lo establecido por los artículos 1310 mil trescientos diez y 1311 mil trescientos once del Código Civil para el Estado de Jalisco en vigor.

QUINTA.- Manifiesta "LA PARTE ARRENDATARIA", así mismo acepta, que todas las mejoras o remodelaciones que se le hagan al citado inmueble, previa autorización, quedarán en beneficio del propietario del inmueble. Si al desocupar el inmueble "LA PARTE ARRENDATARIA" lo deja dañado, será responsable de las reparaciones de los desperfectos que hubiera ocasionado, excepto por el deterioro normal y además vicios ocultos de la construcción e instalaciones.

SEXTA.- Queda prohibido a "LA PARTE ARRENDATARIA" subarrendar, todo o en parte, ceder sus derechos de este contrato o traspasar el inmueble dado en arrendamiento a terceras personas.

SÉPTIMA.- Manifiestan los comparecientes que en caso de que "LA PARTE ARRENDATARIA" incurra en mora en el pago de las rentas en el lugar y tiempo convenido en este contrato, dará motivo para que pague a "LA PARTE ARRENDADORA" una pena económica mensual equivalente al {RECARGO}% sobre el monto de la renta, hasta que sea cubierto el importe que por concepto de renta debe pagar puntualmente y hasta la fecha en que las llegue a liquidar, y los abonos que en su caso hiciera, si "LA PARTE ARRENDADORA" los acepta, se aplicarán primero al pago de intereses y posteriormente a capital.

OCTAVA.- Queda prohibido a "LA PARTE ARRENDATARIA" hacer variación alguna al inmueble arrendado, aún con carácter de mejora, sin el previo consentimiento dado por escrito por "LA PARTE ARRENDADORA", renunciando expresamente "LA PARTE ARRENDATARIA" a la indemnización prevista por el artículo 931 novecientos treinta y uno, así como a lo dispuesto por los artículos 2003 dos mil tres y 2004 dos mil cuatro del Código Civil del Estado de Jalisco.

NOVENA.- Queda prohibido a "LA PARTE ARRENDATARIA" guardar, conservar o tener materiales explosivos o inflamables en el inmueble arrendado; será responsable de los daños y perjuicios que se causen al inmueble arrendado con motivo de cualquier siniestro que acontezca y que dañe al inmueble, aun tratándose de caso fortuito o de fuerza mayor. "LA PARTE ARRENDATARIA" deberá conducirse con toda decencia, moralidad y de acuerdo con las buenas costumbres.

DÉCIMA.- "LA PARTE ARRENDATARIA" dará lugar a la rescisión de este contrato, además de las causales que se expresan en el artículo 2144 dos mil ciento cuarenta y cuatro del Código Civil del Estado de Jalisco, obligándose a la desocupación inmediata del INMUEBLE arrendado en un plazo no mayor de 15 QUINCE DÍAS, por las siguientes causas:
a) Subarrendar, traspasar o ceder sus derechos "LA PARTE ARRENDATARIA" respecto del bien inmueble materia de este contrato.
b) Que "LA PARTE ARRENDATARIA" deje de pagar a "LA PARTE ARRENDADORA" 2 dos rentas consecutivas.
c) Variar el inmueble dado en arrendamiento, haciéndole "LA PARTE ARRENDATARIA" modificaciones útiles o de ornato.
d) Que "LA PARTE ARRENDATARIA" destine el inmueble arrendado a un uso diferente al convenido en este contrato.
e) Guardar en el inmueble substancias peligrosas, explosivas o inflamables.
f) No conducirse "LA PARTE ARRENDATARIA" con moralidad, decencia y de acuerdo con las buenas costumbres en el inmueble arrendado.
g) Causar "LA PARTE ARRENDATARIA" daños y perjuicios al inmueble arrendado.
h) El fallecimiento de "LA PARTE ARRENDATARIA".
i) Cuando viole alguna de las cláusulas aceptadas en el presente contrato.
j) Si se hiciere un notorio mal uso del inmueble arrendado, de modo que éste sufra algún menoscabo o se pueda destruir debido al mal uso.
k) Cuando EL INMUEBLE sea cedido o subarrendado o se use para otro fin.
l) Cuando falte al orden moral y provoque escándalo.
m) "LA PARTE ARRENDATARIA" tendrá un plazo de 10 diez días a partir de la notificación por escrito de "LA PARTE ARRENDADORA" para subsanar cualquier inconformidad.
n) Si "LA PARTE ARRENDATARIA" da motivo a la rescisión del presente contrato por incurrir en cualquiera de las causales a que se refiere esta cláusula, motivará que se le exija también el pago de la pena estipulada en la cláusula cuarta, pena que surtirá efectos a partir de la fecha en que se dé la causal de rescisión.

DÉCIMA PRIMERA.- "LA PARTE ARRENDATARIA" será responsable de los gastos y costos que con motivo de cualquier controversia suscitada con respecto al presente contrato se generen, ya sea en forma judicial o extrajudicial.

DÉCIMA SEGUNDA.- "LA PARTE ARRENDATARIA", en caso de cualquier juicio o notificación, deberá ser notificada en el domicilio del inmueble arrendado. "LA PARTE ARRENDATARIA", al vencimiento del presente contrato y al desocupar el inmueble arrendado, deberá mostrar a "LA PARTE ARRENDADORA" los justificantes correspondientes para demostrar que se encuentra al corriente en el pago de la energía eléctrica respecto del inmueble arrendado, así como del agua y gas. El consumo de energía eléctrica, gas y agua será por cuenta de "LA PARTE ARRENDATARIA". En caso de pago de cuotas a la junta de colonos y condominios, esta erogación será a cargo de "LA PARTE ARRENDATARIA" y su no pago también motivará la rescisión del presente contrato.

DÉCIMA TERCERA.- "LA PARTE ARRENDATARIA" entrega y "LA PARTE ARRENDADORA" recibe a la firma del presente contrato la cantidad de {DEPOSITO} ({DEPOSITO_LETRA}), que corresponde a 1 un mes de depósito y que servirá para garantizar el pago de los daños que se hubieren ocasionado al inmueble arrendado, así como el pago de los servicios de teléfono, luz, gas, licencias municipales y agua que resulten después de desocupar el inmueble, POR LO QUE EL DEPÓSITO POR NINGÚN MOTIVO SE APLICARÁ A RENTAS. Esta cantidad se devolverá a "LA PARTE ARRENDATARIA", sin intereses, una vez entregado el inmueble arrendado y recibido éste de conformidad por "LA PARTE ARRENDADORA", dos meses después del término del presente contrato, y muestre "LA PARTE ARRENDATARIA" la baja del contrato de energía eléctrica y licencias, y que se encuentra al corriente en el pago de gas, agua, cuota de colonos, teléfono en su caso y otras rentas. Si alguno de estos conceptos no estuviere totalmente pagado, de la cantidad depositada se pagarán los conceptos correspondientes, regresando la diferencia a "LA PARTE ARRENDATARIA" si le resultare alguna a su favor; pero si quedare cantidad alguna a su cargo, "LA PARTE ARRENDADORA" se la reclamará como corresponda. Cualquier desperfecto o rotura de las instalaciones o accesorios del inmueble arrendado será a cargo de "LA PARTE ARRENDATARIA", con excepción de las partes de las instalaciones o accesorios que se encuentren en mal estado al momento de recibir el inmueble y que queden asentadas en el inventario previo que se deberá hacer a la entrega del mencionado inmueble.

DÉCIMA CUARTA.- Para todos los efectos a que se refiere la Ley de Extinción de Dominio del Estado de Jalisco y la Ley Federal de Extinción de Dominio, Reglamentaria del Artículo 22 veintidós de la Constitución Política de los Estados Unidos Mexicanos, "LA PARTE ARRENDATARIA" manifiesta que el inmueble arrendado lo utilizará y destinará solo para fines lícitos y de acuerdo a lo manifestado en la Cláusula Primera del presente contrato, por lo que el inmueble arrendado no lo utilizará ni lo destinará para fines ilícitos, liberando a "LA PARTE ARRENDADORA" de cualquier responsabilidad civil, penal, fiscal o de otra índole que pudiera generarse en perjuicio de "LA PARTE ARRENDADORA" o de sus bienes.

DÉCIMA QUINTA.- "LA PARTE FIADORA", quien acude a la celebración de este contrato, se obliga a favor de "LA PARTE ARRENDADORA", constituyéndose junto con "LA PARTE ARRENDATARIA" como deudor directo, universal y solidario, con renuncia a los derechos de orden y excusión, por todo el tiempo que dure la obligación de "LA PARTE ARRENDATARIA" y hasta la total devolución del inmueble, tanto la material como la jurídica, por lo que "LA PARTE FIADORA" renuncia expresamente a lo establecido por el artículo 2143 dos mil ciento cuarenta y tres del Código Civil para el Estado de Jalisco.

DÉCIMA SEXTA.- "LA PARTE FIADORA" manifiesta que es una persona solvente y se obliga a conservar dicha solvencia durante todo el tiempo que dure la ocupación del inmueble y hasta su total desocupación y pago de las obligaciones a cargo de "LA PARTE ARRENDATARIA".

DÉCIMA SÉPTIMA.- Para la interpretación y cumplimiento del presente contrato, las partes se someten a la jurisdicción y competencia de los Tribunales del Primer Partido Judicial en el Estado de Jalisco, renunciando a cualquier otro fuero que les pudiera corresponder por razón de su domicilio presente o futuro.

DÉCIMA OCTAVA.- DOMICILIO: "LA PARTE ARRENDADORA" señala como su domicilio el ubicado en {DOM_ARRENDADORA}. "LA PARTE ARRENDATARIA" señala como su domicilio el ubicado en {INQ_DOMICILIO}. "LA PARTE FIADORA" señala como su domicilio el ubicado en {FIA_DOMICILIO}. Cada parte lo señala como su domicilio convencional para oír y recibir toda clase de notificaciones.

LEÍDO lo anterior por las partes comparecientes y advertidos de su valor, alcance y consecuencias legales, se manifestaron conformes con su contenido, lo ratificaron y firmaron el día de su fecha. {CIUDAD}, Jalisco, a {FECHA}.


_______________________          _______________________          _______________________
ARRENDADOR                       ARRENDATARIO                     FIADOR
{FIRMA_ARRENDADOR}
                                 {INQUILINO}                      {FIADOR}`;

const PLANTILLA_PAGARE = `PAGARÉ                                   Bueno por {MONTO}

En {CIUDAD}, Jalisco, a {FECHA}.

Debo y pagaré incondicionalmente por este pagaré a la orden de {ARRENDADOR}, en {CIUDAD}, Jalisco, a la vista, la cantidad de {MONTO} ({MONTO_LETRA}), valor recibido a mi entera satisfacción, por concepto de garantía de {CONCEPTO} del local {LOCAL} ubicado en {DIRECCION}.
{INTERES}

SUSCRIPTOR: {INQUILINO}
Domicilio: {INQ_DOMICILIO}

Firma: ___________________________


AVAL: {FIADOR}
Domicilio: {FIA_DOMICILIO}

Firma: ___________________________`;
