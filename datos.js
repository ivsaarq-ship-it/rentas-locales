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
  { id: "TES", municipio: "Tlaquepaque", nombre: "Tesoro", direccion: "Prol. Av. Las Fuentes 2846, Paisajes del Tesoro, 45080 San Pedro Tlaquepaque, Jal." },
  { id: "CRE", municipio: "Tlaquepaque", nombre: "Camino Real", direccion: "Av. Camino Real a Colima 161, Haciendas La Candelaria, 45600 Santa Anita, Jal." },
  { id: "CAN", municipio: "Tlaquepaque", nombre: "La Candelaria", direccion: "Virgen de San Juan de Los Lagos 540, Haciendas La Candelaria, 45600 Santa Anita, Jal." },
  { id: "STM", municipio: "Tlaquepaque", nombre: "Sta. María", direccion: "C. Comonfort 6102, El Real, 45601 San Pedro Tlaquepaque, Jal." },
  { id: "BAZ", municipio: "Tlaquepaque", nombre: "Bazar Sur", direccion: "Cerca de Colón 1000, Santa María Tequepexpan, 45601 San Pedro Tlaquepaque, Jal." },
  { id: "VAR", municipio: "Guadalajara", nombre: "Plaza Variedades", direccion: "Av. Juárez 165, Zona Centro, 44100 Guadalajara, Jal." },
  { id: "LMT", municipio: "Zapopan", nombre: "López Mateos", direccion: "Plaza Comercial Sur VIP, Av. Adolfo López Mateos Sur 2043, El Mante, 45235 Zapopan, Jal." },
];

// [plaza, número, nivel, giro, estado]
const LOCALES_INICIALES = [
  ["TES", "2846", "Planta baja", "Vinatería", "rentado"],
  ["TES", "2846-1", "Planta baja", "Chilaquiles", "rentado"],
  ["TES", "2846-2", "Planta baja", "Tacos", "rentado"],
  ["TES", "2846-3", "1er nivel", "", "vacio"],
  ["TES", "2846-4", "1er nivel", "", "vacio"],
  ["TES", "2846-5", "1er nivel", "Brunchies", "rentado"],
  ["TES", "2846-6", "2do nivel", "Calle Center", "rentado"],
  ["TES", "2846-7", "2do nivel", "", "vacio"],
  ["TES", "2846-8", "2do nivel", "Ramen", "rentado"],
  ["CRE", "161", "Planta baja", "Vinatería", "rentado"],
  ["CRE", "161-A", "Planta baja", "Reparación de electrodomésticos", "rentado"],
  ["CRE", "161-B", "Planta baja", "Decoración de eventos", "rentado"],
  ["CRE", "159", "1er nivel", "Siacirp", "rentado"],
  ["CRE", "159-A", "1er nivel", "Veterinaria", "rentado"],
  ["CRE", "158-B", "1er nivel", "Paneles solares", "rentado"],
  ["CAN", "1", "1er nivel", "Carpintería", "rentado"],
  ["CAN", "2", "1er nivel", "Estética", "rentado"],
  ["CAN", "3", "1er nivel", "Abarrotes", "rentado"],
  ["CAN", "4", "1er nivel", "Abarrotes", "rentado"],
  ["CAN", "5", "1er nivel", "", "vacio"],
  ["CAN", "6", "1er nivel", "", "vacio"],
  ["STM", "6102", "Planta baja", "Tornillos", "rentado"],
  ["STM", "6102-A", "1er nivel", "Bodega", "rentado"],
  ["BAZ", "Local", "", "", "venta"],
  ["VAR", "C163", "", "", "vacio"],
  ["VAR", "C163-A", "", "", "vacio"],
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
  arrendador: "Sandra Velasco",
  telefono: "",
  ciudadFirma: "San Pedro Tlaquepaque",
  gracia: 5,
  avisoRenovacion: 60,
  diasLuz: 65,
  inflacion: 0,
  recargo: 0,
  interesPagare: "",
  mesesContrato: 12,
  docsLicencia: DOCS_LICENCIA_TEXTO,
};

const TEXTO_REQUISITOS =
  "Hola, para preparar tu contrato del local necesito que me mandes por aquí foto clara de:\n\n" +
  "*Inquilino*\n• INE vigente (por ambos lados)\n• Comprobante de domicilio no mayor a 3 meses\n• Nombre completo, correo y giro del negocio\n\n" +
  "*Fiador solidario*\n• INE vigente (por ambos lados)\n• Comprobante de domicilio no mayor a 3 meses\n\n" +
  "*Al firmar*\n• Pagaré por un mes de renta\n• Pagaré por un mes de depósito\n• Pago del primer mes y del depósito\n\nGracias.";

// Contrato modelo PROVISIONAL: se cambia por el de Sandra en Ajustes > Contrato.
const PLANTILLA_CONTRATO = `CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL

En {CIUDAD}, Jalisco, a {FECHA}, celebran el presente contrato, por una parte {ARRENDADOR}, a quien se le llamará "LA ARRENDADORA", y por la otra {INQUILINO}, con domicilio en {INQ_DOMICILIO}, a quien se le llamará "EL ARRENDATARIO", con la comparecencia de {FIADOR}, con domicilio en {FIA_DOMICILIO}, como "FIADOR SOLIDARIO", al tenor de las siguientes cláusulas:

PRIMERA. OBJETO. LA ARRENDADORA da en arrendamiento a EL ARRENDATARIO el local comercial número {LOCAL}, {NIVEL}, ubicado en {DIRECCION}.

SEGUNDA. DESTINO. El local se destinará exclusivamente al giro de {GIRO}. EL ARRENDATARIO tramitará y pagará por su cuenta la licencia de giro y los permisos que su negocio requiera, y entregará copia a LA ARRENDADORA.

TERCERA. RENTA. La renta mensual es de {RENTA} ({RENTA_LETRA}), pagadera por adelantado el día {DIA_PAGO} de cada mes. Se concede un plazo de gracia de {GRACIA} días hábiles después de la fecha de pago.

CUARTA. DEPÓSITO. EL ARRENDATARIO entrega la cantidad de {DEPOSITO} ({DEPOSITO_LETRA}) como depósito en garantía, que se devolverá al terminar el contrato, una vez entregado el local en buen estado y sin adeudos de renta ni servicios. El depósito no podrá aplicarse al pago de rentas.

QUINTA. PLAZO. El contrato tiene una duración de {MESES} meses, del {INICIO} al {FIN}. Para renovarlo se firmará un nuevo contrato; la renta se actualizará conforme a la inflación (INPC) o al valor del inmueble en el mercado.

SEXTA. SERVICIOS. Los pagos de luz, agua, teléfono, internet y cualquier otro servicio del local son por cuenta de EL ARRENDATARIO, quien entregará los comprobantes cuando LA ARRENDADORA los solicite.

SÉPTIMA. CONSERVACIÓN. EL ARRENDATARIO recibe el local en buen estado y se obliga a devolverlo igual, salvo el desgaste normal. No podrá hacer modificaciones sin permiso por escrito de LA ARRENDADORA; las mejoras quedarán a favor del inmueble.

OCTAVA. SUBARRENDAMIENTO. EL ARRENDATARIO no podrá subarrendar ni ceder el local, total o parcialmente.

NOVENA. PAGARÉS. En garantía del cumplimiento, EL ARRENDATARIO suscribe, con el aval de EL FIADOR SOLIDARIO, un pagaré por el importe de un mes de renta y otro por el importe del depósito.

DÉCIMA. FIADOR SOLIDARIO. {FIADOR} se obliga solidariamente con EL ARRENDATARIO al cumplimiento de todas las obligaciones de este contrato, hasta la entrega física del local, y renuncia a los beneficios de orden y excusión.

DÉCIMA PRIMERA. RESCISIÓN. Son causas de rescisión: la falta de pago de dos o más mensualidades, dar al local un uso distinto al pactado, subarrendarlo y no contar con la licencia de giro.

DÉCIMA SEGUNDA. JURISDICCIÓN. Para la interpretación y cumplimiento de este contrato, las partes se someten a las leyes y tribunales del Estado de Jalisco.

Leído el contrato, las partes lo firman de conformidad.


_______________________          _______________________          _______________________
LA ARRENDADORA                   EL ARRENDATARIO                  FIADOR SOLIDARIO
{ARRENDADOR}                     {INQUILINO}                      {FIADOR}`;

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
