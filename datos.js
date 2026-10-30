// Datos iniciales y plantillas. Lo que Sandra cambie se guarda en su celular, no aquí.

const PLAZAS_INICIALES = [
  { id: "TES", nombre: "Tesoro", direccion: "Prol. Av. Las Fuentes 2846, Paisajes del Tesoro, 45080 San Pedro Tlaquepaque, Jal." },
  { id: "CRE", nombre: "Camino Real", direccion: "Av. Camino Real a Colima 161, Haciendas La Candelaria, 45600 Santa Anita, Jal." },
  { id: "CAN", nombre: "La Candelaria", direccion: "Virgen de San Juan de Los Lagos 540, Haciendas La Candelaria, 45600 Santa Anita, Jal." },
  { id: "STM", nombre: "Sta. María", direccion: "C. Comonfort 6102, El Real, 45601 San Pedro Tlaquepaque, Jal." },
  { id: "BAZ", nombre: "Bazar Sur", direccion: "Cerca de Colón 1000, Santa María Tequepexpan, 45601 San Pedro Tlaquepaque, Jal." },
  { id: "VAR", nombre: "Plaza Variedades", direccion: "Av. Juárez 165, Zona Centro, 44100 Guadalajara, Jal." },
  { id: "LMT", nombre: "López Mateos", direccion: "Plaza Comercial Sur VIP, Av. Adolfo López Mateos Sur 2043, El Mante, 45235 Zapopan, Jal." },
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
  docsLicencia:
    "Copia del contrato de arrendamiento firmado\n" +
    "Copia de identificación de la arrendadora\n" +
    "Copia del último recibo de predial del inmueble\n" +
    "Dirección completa y número del local\n" +
    "(Confirma en ventanilla del municipio si piden algo más)",
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
