from dataclasses import dataclass, field
from typing import Any


@dataclass
class BlueprintDefinition:
    id: str
    title: str
    description: str
    category: str
    difficulty: str
    icon: str
    skills_tested: list[str]
    default_rows: int
    source_sheet_name: str
    task_sheet_name: str
    supported_industries: list[dict[str, str]]
    instructions_template: str
    criteria_definitions: list[dict[str, str]]


BLUEPRINTS: dict[str, BlueprintDefinition] = {
    "pivot_sales_fulfillment": BlueprintDefinition(
        id="pivot_sales_fulfillment",
        title="Tablas Dinámicas y Análisis de Surtimiento",
        description="Evalúa la capacidad de crear tablas dinámicas, agrupar por períodos, calcular sumatorias y promedios por almacén o sucursal.",
        category="Excel Avanzado / Tablas Dinámicas",
        difficulty="intermediate",
        icon="Table",
        skills_tested=[
            "Creación de Tablas Dinámicas",
            "Agrupación por Mes y Sucursal",
            "Cálculo de Importes y Piezas Surtidas",
            "Filtrado y Formato Numérico",
        ],
        default_rows=200,
        source_sheet_name="BaseDatos",
        task_sheet_name="RealizaEjercicio",
        supported_industries=[
            {
                "id": "pharma",
                "label": "Sector Salud y Farmacéutico",
                "description": "Suministro de medicamentos, unidades médicas y almacenes hospitalarios.",
            },
            {
                "id": "retail",
                "label": "Comercio Retail y Tiendas",
                "description": "Venta de productos de consumo, sucursales y canales de distribución.",
            },
            {
                "id": "logistics",
                "label": "Logística y Envíos",
                "description": "Distribución de paquetería, centros de distribución y rutas.",
            },
            {
                "id": "services",
                "label": "Corporativo y Servicios",
                "description": "Órdenes de servicio, áreas operativas y centros de costos.",
            },
        ],
        instructions_template=(
            "INSTRUCCIONES DEL EJERCICIO:\n"
            "1. En la hoja 'BaseDatos' se encuentra el registro histórico de órdenes y surtimiento.\n"
            "2. En la hoja 'RealizaEjercicio', genera una Tabla Dinámica estructurada de la siguiente forma:\n"
            "   - Filas: 'MES' (Enero, Febrero, etc.)\n"
            "   - Columnas: 'SUCURSAL' o 'ALMACEN'\n"
            "   - Valores: Suma de 'IMPORTE_TOTAL' y Suma de 'PIEZAS_SURTIDAS'\n"
            "3. En la sección de Resumen de Control (hoja 'RealizaEjercicio'), completa las celdas indicadas con los totales generales calculados.\n"
            "4. Guarda y sube este mismo archivo con tus resultados."
        ),
        criteria_definitions=[
            {
                "name": "Estructura de Tabla Dinámica",
                "description": "Presencia de tabla dinámica o matriz resumen con desglose mensual y por sucursal.",
            },
            {
                "name": "Totales de Importe",
                "description": "Cálculo exacto de sumas de importes globales y mensuales.",
            },
            {
                "name": "Volumen de Piezas",
                "description": "Cálculo de cantidades y piezas totales surtidas.",
            },
        ],
    ),
    "vlookup_catalog_pricing": BlueprintDefinition(
        id="vlookup_catalog_pricing",
        title="Cruce de Catálogos con BUSCARV / BUSCARX",
        description="Evalúa fórmulas de búsqueda, cruce de bases de datos, cálculo de subtotales, descuentos y fórmulas condicionales.",
        category="Fórmulas y Funciones",
        difficulty="intermediate",
        icon="Search",
        skills_tested=[
            "Fórmulas de Búsqueda (BUSCARV / BUSCARX / INDICE-COINCIDIR)",
            "Cálculo de Precios e Importes",
            "Manejo de Códigos y Claves Únicas",
            "Validación de Referencias Absolutas ($)",
        ],
        default_rows=150,
        source_sheet_name="Transacciones",
        task_sheet_name="RealizaEjercicio",
        supported_industries=[
            {
                "id": "pharma",
                "label": "Farmacéutica y Material Médico",
                "description": "Catálogo de medicamentos, claves SSA y precios unitarios.",
            },
            {
                "id": "retail",
                "label": "Retail y Supermercados",
                "description": "Catálogo de SKUs, familias de producto y listas de precios.",
            },
            {
                "id": "hardware",
                "label": "Ferretería y Mayoreo",
                "description": "Catálogo de refacciones, códigos de barras y proveedores.",
            },
        ],
        instructions_template=(
            "INSTRUCCIONES DEL EJERCICIO:\n"
            "1. En la hoja 'Transacciones' dispones del listado de folios con 'CODIGO_PRODUCTO' y 'CANTIDAD'.\n"
            "2. En la hoja 'Catalogos' tienes la lista maestra con 'CODIGO', 'DESCRIPCION', 'CATEGORIA' y 'PRECIO_UNITARIO'.\n"
            "3. En la hoja 'RealizaEjercicio', completa la matriz aplicando fórmulas:\n"
            "   - Columna Descripción: Obtén el nombre usando BUSCARV o BUSCARX con base en el código.\n"
            "   - Columna Precio Unitario: Obtén el precio del catálogo.\n"
            "   - Columna Subtotal: Multiplica Cantidad x Precio Unitario.\n"
            "   - Columna Total con IVA: Aplica el 16% de impuesto correspondiente.\n"
            "4. Llena el panel de totales de control al pie de la tabla."
        ),
        criteria_definitions=[
            {
                "name": "Búsqueda de Catálogo",
                "description": "Cruce correcto de descripciones y categorías mediante fórmulas.",
            },
            {
                "name": "Cálculo de Precios e Impuestos",
                "description": "Exactitud en multiplicaciones de cantidad, precio y aplicación de IVA.",
            },
            {
                "name": "Totales Globales de Control",
                "description": "Sumatorias consolidadas del ejercicio.",
            },
        ],
    ),
    "logic_kpi_evaluation": BlueprintDefinition(
        id="logic_kpi_evaluation",
        title="Fórmulas Lógicas (SI, Y, O) y Cumplimiento de Metas",
        description="Evalúa lógica condicional anidada, cálculo de comisiones/bonos, indicadores de cumplimiento y semáforos de desempeño.",
        category="Lógica de Negocio y KPIs",
        difficulty="basic",
        icon="CheckSquare",
        skills_tested=[
            "Función SI (IF) y SI Anidado",
            "Operadores Lógicos (Y / O)",
            "Cálculo de % de Cumplimiento",
            "Asignación de Estatus y Bonificaciones",
        ],
        default_rows=120,
        source_sheet_name="RegistroMetas",
        task_sheet_name="RealizaEjercicio",
        supported_industries=[
            {
                "id": "sales",
                "label": "Fuerza de Ventas y Asesores",
                "description": "Metas de venta individual, cumplimiento porcentual y comisiones.",
            },
            {
                "id": "hr",
                "label": "Recursos Humanos y Nómina",
                "description": "Evaluación de puntualidad, asistencia y bonos de productividad.",
            },
            {
                "id": "operations",
                "label": "Operaciones y Entregas",
                "description": "Tiempos de entrega vs SLAs y estatus de servicio.",
            },
        ],
        instructions_template=(
            "INSTRUCCIONES DEL EJERCICIO:\n"
            "1. En la hoja 'RegistroMetas' se listan los colaboradores con su 'META_ASIGNADA' y su 'LOGRO_REAL'.\n"
            "2. En la hoja 'RealizaEjercicio', formula las siguientes columnas:\n"
            "   - '% Cumplimiento': Logro Real / Meta Asignada (formato porcentaje).\n"
            "   - 'Estatus': Si el % >= 100%, asignar 'CUMPLIDO'; si está entre 80% y 99.9%, 'REGULAR'; si es menor a 80%, 'DEFICIENTE'.\n"
            "   - 'Bono Asignado': Si Estatus es 'CUMPLIDO', otorgar $5,000; si es 'REGULAR', $2,000; de lo contrario $0.\n"
            "3. Completa los conteos de colaboradores por estatus y la suma total de bonos a dispersar."
        ),
        criteria_definitions=[
            {
                "name": "Porcentaje de Efectividad",
                "description": "Fórmulas exactas de cociente de cumplimiento.",
            },
            {
                "name": "Condicionales de Estatus",
                "description": "Lógica anidada correcta para clasificar el desempeño.",
            },
            {
                "name": "Cálculo de Bonificaciones y Resumen",
                "description": "Asignación de importes monetarios y consolidación general.",
            },
        ],
    ),
    "audit_reconciliation": BlueprintDefinition(
        id="audit_reconciliation",
        title="Conciliación de Datos y Detección de Discrepancias",
        description="Evalúa habilidades de auditoría, comparación entre inventario físico vs sistema o estado de cuenta vs registros internos.",
        category="Auditoría y Control Interno",
        difficulty="advanced",
        icon="Scale",
        skills_tested=[
            "Detección de Discrepancias y Faltantes",
            "Fórmulas Condicionales de Cuadre",
            "Cálculo de Diferencias Monetarias",
            "Consolidación de Saldos Auditados",
        ],
        default_rows=160,
        source_sheet_name="DatosAuditoria",
        task_sheet_name="RealizaEjercicio",
        supported_industries=[
            {
                "id": "finance",
                "label": "Finanzas y Tesorería",
                "description": "Conciliación bancaria de movimientos contables vs extracto.",
            },
            {
                "id": "inventory",
                "label": "Inventarios y Almacén",
                "description": "Conteo físico de existencias vs sistema ERP.",
            },
            {
                "id": "invoicing",
                "label": "Facturación y Cobranza",
                "description": "Cruces de folios fiscales emitidos vs pagos recibidos.",
            },
        ],
        instructions_template=(
            "INSTRUCCIONES DEL EJERCICIO:\n"
            "1. En la hoja 'DatosAuditoria' dispones de dos columnas clave: 'REGISTRO_SISTEMA' y 'CONTEO_FISICO'.\n"
            "2. En la hoja 'RealizaEjercicio', resuelve las columnas de auditoría:\n"
            "   - 'Diferencia en Unidades': Conteo Físico - Registro Sistema.\n"
            "   - 'Importe Discrepancia': Diferencia en Unidades x Costo Unitario.\n"
            "   - 'Dictamen': Si la diferencia es 0, 'CUADRADO'; si es > 0, 'SOBRANTE'; si es < 0, 'FALTANTE'.\n"
            "3. En el bloque de control superior, calcula el total neto de diferencias y el número de partidas con faltante."
        ),
        criteria_definitions=[
            {
                "name": "Diferencias Físicas y Monetarias",
                "description": "Cálculo exacto de restas y valorización del desvío.",
            },
            {
                "name": "Dictamen Condicional",
                "description": "Lógica condicional de clasificación (CUADRADO, SOBRANTE, FALTANTE).",
            },
        ],
    ),
}


def get_instructions_for_blueprint(blueprint_id: str, difficulty: str = "intermediate") -> str:
    if blueprint_id == "pivot_sales_fulfillment":
        if difficulty == "basic":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL BÁSICO):\n"
                "1. En la hoja 'BaseDatos' se encuentra el registro transaccional de órdenes.\n"
                "2. En la hoja 'RealizaEjercicio', genera una Tabla Dinámica sencilla:\n"
                "   - Filas: 'MES' (Enero, Febrero, etc.)\n"
                "   - Valores: Suma de 'IMPORTE_TOTAL'\n"
                "3. En la sección de Resumen de Control (hoja 'RealizaEjercicio'), escribe el Total General de Importe y el Total de Enero.\n"
                "4. Guarda y sube este mismo archivo con tus resultados."
            )
        elif difficulty == "advanced":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL AVANZADO):\n"
                "1. En la hoja 'BaseDatos' se encuentra el registro histórico de órdenes y surtimiento.\n"
                "2. En la hoja 'RealizaEjercicio', genera una Tabla Dinámica estructurada así:\n"
                "   - Filas: 'MES' (Enero, Febrero, etc.)\n"
                "   - Columnas: 'SUCURSAL' o 'ALMACEN'\n"
                "   - Valores: Suma de 'IMPORTE_TOTAL' y Suma de 'PIEZAS_SURTIDAS'\n"
                "3. En la sección de Resumen de Control, completa los totales generales, el promedio por orden, el total de Enero y el total de Febrero.\n"
                "4. Guarda y sube este mismo archivo con tus resultados."
            )
        else:
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL INTERMEDIO):\n"
                "1. En la hoja 'BaseDatos' se encuentra el registro histórico de órdenes y surtimiento.\n"
                "2. En la hoja 'RealizaEjercicio', genera una Tabla Dinámica estructurada de la siguiente forma:\n"
                "   - Filas: 'MES' (Enero, Febrero, etc.)\n"
                "   - Columnas: 'SUCURSAL' o 'ALMACEN'\n"
                "   - Valores: Suma de 'IMPORTE_TOTAL' y Suma de 'PIEZAS_SURTIDAS'\n"
                "3. En la sección de Resumen de Control (hoja 'RealizaEjercicio'), completa las celdas indicadas con los totales generales calculados.\n"
                "4. Guarda y sube este mismo archivo con tus resultados."
            )
    elif blueprint_id == "vlookup_catalog_pricing":
        if difficulty == "basic":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL BÁSICO):\n"
                "1. En la hoja 'Transacciones' dispones del listado de folios con 'CODIGO_PRODUCTO' y 'CANTIDAD'.\n"
                "2. En la hoja 'Catalogos' tienes la lista maestra con 'CODIGO', 'DESCRIPCION' y 'PRECIO_UNITARIO'.\n"
                "3. En la hoja 'RealizaEjercicio', formula las columnas requeridas:\n"
                "   - Descripción: Aplica BUSCARV o BUSCARX para traer el nombre del producto.\n"
                "   - Precio Unitario: Aplica BUSCARV o BUSCARX para traer el precio del catálogo.\n"
                "   - Total: Multiplica Cantidad x Precio Unitario.\n"
                "4. Calcula el Total General al pie de la tabla."
            )
        elif difficulty == "advanced":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL AVANZADO):\n"
                "1. En la hoja 'Transacciones' dispones de los folios con 'CODIGO_PRODUCTO', 'CANTIDAD' y porcentaje de descuento.\n"
                "2. En la hoja 'Catalogos' tienes la lista maestra completa con descripciones, categorías y precios.\n"
                "3. En la hoja 'RealizaEjercicio', resuelve la matriz completa aplicando fórmulas:\n"
                "   - Descripción y Categoría: Mediante BUSCARV o BUSCARX con base en el código.\n"
                "   - Precio Unitario: Obtén el precio del catálogo.\n"
                "   - Descuento Monetario: (Cantidad x Precio) x % Descuento.\n"
                "   - Subtotal Neto: Importe bruto menos descuento.\n"
                "   - IVA (16%): Aplica el 16% sobre el subtotal neto.\n"
                "   - Total Final: Subtotal neto + IVA.\n"
                "4. Completa la fila de totales generales al pie de la tabla."
            )
        else:
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL INTERMEDIO):\n"
                "1. En la hoja 'Transacciones' dispones del listado de folios con 'CODIGO_PRODUCTO' y 'CANTIDAD'.\n"
                "2. En la hoja 'Catalogos' tienes la lista maestra con 'CODIGO', 'DESCRIPCION', 'CATEGORIA' y 'PRECIO_UNITARIO'.\n"
                "3. En la hoja 'RealizaEjercicio', completa la matriz aplicando fórmulas:\n"
                "   - Columna Descripción: Obtén el nombre usando BUSCARV o BUSCARX con base en el código.\n"
                "   - Columna Categoría: Obtén la categoría con búsqueda de catálogo.\n"
                "   - Columna Precio Unitario: Obtén el precio del catálogo.\n"
                "   - Columna Subtotal: Multiplica Cantidad x Precio Unitario.\n"
                "   - Columna IVA (16%): Calcula el 16% del subtotal.\n"
                "   - Columna Total: Subtotal + IVA.\n"
                "4. Llena la fila de totales generales al pie de la tabla."
            )
    elif blueprint_id == "logic_kpi_evaluation":
        if difficulty == "basic":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL BÁSICO):\n"
                "1. En la hoja 'RegistroMetas' se listan los colaboradores con 'META_ASIGNADA' y 'LOGRO_REAL'.\n"
                "2. En la hoja 'RealizaEjercicio', formula:\n"
                "   - '% Cumplimiento': Logro Real / Meta Asignada (formato porcentaje).\n"
                "   - 'Estatus': Si % >= 100%, asignar 'CUMPLIDO'; de lo contrario 'NO CUMPLIDO'.\n"
                "   - 'Bono': Si es 'CUMPLIDO', otorgar $3,000; de lo contrario $0.\n"
                "3. Completa la suma total de bonos al final de la tabla."
            )
        elif difficulty == "advanced":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL AVANZADO):\n"
                "1. En la hoja 'RegistroMetas' se listan los colaboradores con sus metas y logro real.\n"
                "2. En la hoja 'RealizaEjercicio', formula la matriz con lógica condicional anidada:\n"
                "   - '% Cumplimiento': Logro / Meta.\n"
                "   - 'Estatus': Si % >= 115%, 'SOBRESALIENTE'; si >= 100%, 'CUMPLIDO'; si >= 80%, 'REGULAR'; si < 80%, 'DEFICIENTE'.\n"
                "   - 'Comisión Variable': Si 'SOBRESALIENTE' -> 10% del logro; si 'CUMPLIDO' -> 6%; si 'REGULAR' -> 2%; si 'DEFICIENTE' -> $0.\n"
                "   - 'Bono Fijo': $3,000 extra solo si superó el 100%.\n"
                "   - 'Compensación Total': Comisión Variable + Bono Fijo.\n"
                "3. Calcula los totales consolidados al pie de la tabla."
            )
        else:
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL INTERMEDIO):\n"
                "1. En la hoja 'RegistroMetas' se listan los colaboradores con su 'META_ASIGNADA' y su 'LOGRO_REAL'.\n"
                "2. En la hoja 'RealizaEjercicio', formula las siguientes columnas:\n"
                "   - '% Cumplimiento': Logro Real / Meta Asignada (formato porcentaje).\n"
                "   - 'Estatus': Si el % >= 100%, asignar 'CUMPLIDO'; si está entre 80% y 99.9%, 'REGULAR'; si es menor a 80%, 'DEFICIENTE'.\n"
                "   - 'Bono Asignado': Si Estatus es 'CUMPLIDO', otorgar $5,000; si es 'REGULAR', $2,000; de lo contrario $0.\n"
                "3. Completa los totales consolidados al pie de la tabla."
            )
    elif blueprint_id == "audit_reconciliation":
        if difficulty == "basic":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL BÁSICO):\n"
                "1. En la hoja 'DatosAuditoria' dispones de 'REGISTRO_SISTEMA' y 'CONTEO_FISICO'.\n"
                "2. En la hoja 'RealizaEjercicio', resuelve:\n"
                "   - 'Diferencia en Unidades': Conteo Físico - Registro Sistema.\n"
                "   - 'Importe Discrepancia': Diferencia en Unidades x Costo Unitario.\n"
                "3. Calcula la suma total neta de discrepancia monetaria al pie de la tabla."
            )
        elif difficulty == "advanced":
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL AVANZADO):\n"
                "1. En la hoja 'DatosAuditoria' dispones de inventarios teóricos y físicos con costos.\n"
                "2. En la hoja 'RealizaEjercicio', resuelve la matriz de auditoría técnica:\n"
                "   - 'Diferencia en Unidades': Conteo Físico - Sistema.\n"
                "   - 'Importe Discrepancia': Diferencia x Costo Unitario.\n"
                "   - '% Desviación': Diferencia Unidades / Registro Sistema (en porcentaje).\n"
                "   - 'Criticidad': Si |Importe| >= $5,000 o |% Desviación| >= 15%, 'CRÍTICO'; de lo contrario 'TOLERABLE'.\n"
                "   - 'Dictamen': Si Diferencia = 0, 'CUADRADO'; si > 0, 'SOBRANTE'; si < 0, 'FALTANTE'.\n"
                "3. Completa los totales de control y la suma neta de diferencias."
            )
        else:
            return (
                "INSTRUCCIONES DEL EJERCICIO (NIVEL INTERMEDIO):\n"
                "1. En la hoja 'DatosAuditoria' dispones de 'REGISTRO_SISTEMA' y 'CONTEO_FISICO'.\n"
                "2. En la hoja 'RealizaEjercicio', resuelve las columnas de auditoría:\n"
                "   - 'Diferencia en Unidades': Conteo Físico - Registro Sistema.\n"
                "   - 'Importe Discrepancia': Diferencia en Unidades x Costo Unitario.\n"
                "   - 'Dictamen': Si la diferencia es 0, 'CUADRADO'; si es > 0, 'SOBRANTE'; si es < 0, 'FALTANTE'.\n"
                "3. En el bloque de totales inferior, calcula el importe neto consolidado de discrepancia."
            )
    return "Sigue las instrucciones del ejercicio indicadas en la hoja."
