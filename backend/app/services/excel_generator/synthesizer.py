import datetime
import random
from typing import Any


class DataSynthesizer:
    """
    Generador de datos sintéticos realistas con variación anti-copia mediante semillas aleatorias.
    """

    MONTH_NAMES = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    INDUSTRY_DATA = {
        "pharma": {
            "locations": ["Almacén Central", "Hospital General", "Clínica Norte", "Farmacia Sur", "Centro Médico Oriente", "Unidad Poniente"],
            "products": [
                {"code": "MED-101", "name": "Paracetamol 500mg (Caja c/20)", "cat": "Analgésicos", "price": 45.50},
                {"code": "MED-102", "name": "Ibuprofeno 400mg (Caja c/10)", "cat": "Antiinflamatorios", "price": 68.00},
                {"code": "MED-103", "name": "Amoxicilina 500mg (Frasco)", "cat": "Antibióticos", "price": 125.00},
                {"code": "MED-104", "name": "Omeprazol 20mg (Caja c/14)", "cat": "Gastroenterología", "price": 89.00},
                {"code": "MED-105", "name": "Losartán 50mg (Caja c/30)", "cat": "Cardiología", "price": 140.00},
                {"code": "MED-106", "name": "Metformina 850mg (Caja c/30)", "cat": "Endocrinología", "price": 95.50},
                {"code": "MED-107", "name": "Ketorolaco 10mg (Caja c/10)", "cat": "Analgésicos", "price": 75.00},
                {"code": "MED-108", "name": "Salbutamol Aerosol 100mcg", "cat": "Neumología", "price": 185.00},
                {"code": "MED-109", "name": "Solución Fisiológica 500ml", "cat": "Soluciones", "price": 38.00},
                {"code": "MED-110", "name": "Jeringas Desechables 5ml (c/100)", "cat": "Material Quirúrgico", "price": 210.00},
            ],
            "agents": ["Dr. Carlos Méndez", "Dra. Laura Morales", "Lic. Roberto Silva", "Enf. Ana Karen Soto", "QFB. Miguel Torres", "Dra. Sofía Rivas", "Lic. Jorge Valdez", "Dra. Gabriela Vega"],
        },
        "retail": {
            "locations": ["Sucursal Polanco", "Sucursal Insurgentes", "Sucursal Santa Fe", "Sucursal Coyoacán", "Sucursal Guadalajara", "Sucursal Monterrey"],
            "products": [
                {"code": "RET-201", "name": "Café Gourmet Grano 1kg", "cat": "Abarrotes", "price": 195.00},
                {"code": "RET-202", "name": "Aceite de Oliva Extra Virgen 750ml", "cat": "Abarrotes", "price": 175.50},
                {"code": "RET-203", "name": "Detergente Líquido Concentrado 3L", "cat": "Limpieza", "price": 145.00},
                {"code": "RET-204", "name": "Papel Higiénico Premium 12 Rollos", "cat": "Limpieza", "price": 110.00},
                {"code": "RET-205", "name": "Leche Entera Tetrapack 1L (Pack 6)", "cat": "Lácteos", "price": 162.00},
                {"code": "RET-206", "name": "Queso Manchego Importado 400g", "cat": "Lácteos", "price": 118.00},
                {"code": "RET-207", "name": "Cereal Integral Almendras 500g", "cat": "Desayuno", "price": 78.50},
                {"code": "RET-208", "name": "Agua Purificada 1.5L (Pack 12)", "cat": "Bebidas", "price": 105.00},
                {"code": "RET-209", "name": "Snack Nueces Mixtas 300g", "cat": "Botanas", "price": 135.00},
                {"code": "RET-210", "name": "Shampoo Reparador 750ml", "cat": "Cuidado Personal", "price": 92.00},
            ],
            "agents": ["Valeria Garza", "Esteban Domínguez", "Paola Navarro", "Alejandro Ruiz", "Beatriz Fuentes", "Rodrigo Espinoza", "Mariana Campos", "Héctor Luna"],
        },
        "logistics": {
            "locations": ["CEDIS Norte", "CEDIS Bajío", "Hub Aeropuerto", "Terminal Pacífico", "CEDIS Sureste", "Almacén Fiscal"],
            "products": [
                {"code": "LOG-301", "name": "Guía Estándar Nacional 1kg", "cat": "Paquetería", "price": 160.00},
                {"code": "LOG-302", "name": "Guía Express 24 Horas", "cat": "Paquetería Express", "price": 280.00},
                {"code": "LOG-303", "name": "Flete Tarima Consolidada", "cat": "Carga Pesada", "price": 1850.00},
                {"code": "LOG-304", "name": "Seguro de Carga y Tránsito", "cat": "Servicios Especiales", "price": 320.00},
                {"code": "LOG-305", "name": "Servicio de Embalaje Térmico", "cat": "Servicios Especiales", "price": 210.00},
                {"code": "LOG-306", "name": "Guía Internacional Frontera", "cat": "Internacional", "price": 890.00},
            ],
            "agents": ["Felipe Sandoval", "Diana Corona", "Gerardo Alarcón", "Claudia Mendoza", "Samuel Pacheco", "Rosa Ibarra"],
        },
        "finance": {
            "locations": ["División Corporativa", "Banca Empresarial", "Tesorería Central", "Fideicomisos", "Operaciones Fiduciarias"],
            "products": [
                {"code": "FIN-401", "name": "Póliza de Seguro PyME", "cat": "Seguros", "price": 4200.00},
                {"code": "FIN-402", "name": "Comisión de Gestión Crediticia", "cat": "Comisiones", "price": 1500.00},
                {"code": "FIN-403", "name": "Membresía Terminal Punto de Venta", "cat": "Servicios", "price": 650.00},
                {"code": "FIN-404", "name": "Certificado de Depósito a Plazo", "cat": "Inversiones", "price": 10000.00},
                {"code": "FIN-405", "name": "Emisión de Cheque Certificado", "cat": "Comisiones", "price": 350.00},
            ],
            "agents": ["Lic. Alberto Villalobos", "C.P. Mónica Arredondo", "Lic. Fernando Cossío", "C.P. Patricia Godoy", "Lic. Daniel Treviño", "C.P. Sonia Becerra"],
        },
        "sales": {
            "locations": ["Zona Metropolitana", "Zona Norte", "Zona Occidente", "Zona Golfo", "Zona Pacífico"],
            "products": [],
            "agents": [
                "Andrés Manuel Cárdenas", "Lorena Treviño", "Hugo Sánchez", "Karla Villaseñor",
                "Mauricio Pineda", "Adriana Elizondo", "Ernesto Zedillo", "Pamela Barrientos",
                "Cristian Salgado", "Natalia Orozco", "Tomás Rendón", "Silvia Macías"
            ],
        },
    }

    @classmethod
    def get_industry_pack(cls, industry_id: str) -> dict[str, Any]:
        if industry_id in cls.INDUSTRY_DATA:
            return cls.INDUSTRY_DATA[industry_id]
        return cls.INDUSTRY_DATA["pharma"]

    @classmethod
    def generate_dataset_for_blueprint(
        cls,
        blueprint_id: str,
        industry_id: str,
        row_count: int,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """
        Genera el conjunto de datos sintéticos estructurado para el blueprint seleccionado.
        """
        rng = random.Random(seed if seed is not None else random.randint(1000, 999999))
        pack = cls.get_industry_pack(industry_id)

        if blueprint_id == "pivot_sales_fulfillment":
            return cls._gen_pivot_fulfillment(rng, pack, row_count)
        elif blueprint_id == "vlookup_catalog_pricing":
            return cls._gen_vlookup_pricing(rng, pack, row_count)
        elif blueprint_id == "logic_kpi_evaluation":
            return cls._gen_logic_kpis(rng, pack, row_count)
        elif blueprint_id == "audit_reconciliation":
            return cls._gen_audit_reconciliation(rng, pack, row_count)
        else:
            return cls._gen_pivot_fulfillment(rng, pack, row_count)

    @classmethod
    def _gen_pivot_fulfillment(cls, rng: random.Random, pack: dict[str, Any], count: int) -> dict[str, Any]:
        locations = pack.get("locations", ["Almacén Norte", "Almacén Sur", "Almacén Centro"])
        products = pack.get("products", [
            {"code": "P-1", "name": "Producto Estándar", "price": 100.0, "cat": "General"}
        ])
        
        # Generar fechas a lo largo de 4 a 6 meses
        base_year = 2026
        rows = []
        months_used = ["Enero", "Febrero", "Marzo", "Abril"]

        for i in range(1, count + 1):
            folio = f"FOL-{base_year}-{1000 + i}"
            month_idx = rng.randint(0, len(months_used) - 1)
            month_name = months_used[month_idx]
            day = rng.randint(1, 28)
            date_val = datetime.date(base_year, month_idx + 1, day)
            
            loc = rng.choice(locations)
            prod = rng.choice(products)
            
            qty = rng.randint(5, 120)
            unit_price = round(prod["price"] * rng.uniform(0.95, 1.05), 2)
            total_amount = round(qty * unit_price, 2)
            
            rows.append({
                "FOLIO": folio,
                "FECHA": date_val,
                "MES": month_name,
                "SUCURSAL": loc,
                "CLAVE_PRODUCTO": prod["code"],
                "DESCRIPCION": prod["name"],
                "CANTIDAD_SURTIDA": qty,
                "PRECIO_UNITARIO": unit_price,
                "IMPORTE_TOTAL": total_amount,
            })

        return {
            "type": "pivot_sales_fulfillment",
            "months": months_used,
            "locations": sorted(list(set(r["SUCURSAL"] for r in rows))),
            "rows": rows,
        }

    @classmethod
    def _gen_vlookup_pricing(cls, rng: random.Random, pack: dict[str, Any], count: int) -> dict[str, Any]:
        catalog = pack.get("products", [
            {"code": "P-1", "name": "Producto A", "cat": "Cat 1", "price": 100.0},
            {"code": "P-2", "name": "Producto B", "cat": "Cat 2", "price": 200.0},
        ])
        
        transactions = []
        for i in range(1, count + 1):
            folio = f"TRX-{2000 + i}"
            prod = rng.choice(catalog)
            qty = rng.randint(1, 35)
            disc_pct = rng.choice([0.0, 0.05, 0.10, 0.15])
            
            transactions.append({
                "FOLIO": folio,
                "CODIGO_PRODUCTO": prod["code"],
                "CANTIDAD": qty,
                "DESCUENTO_PCT": disc_pct,
                # Campos calculados para la solución
                "_prod_name": prod["name"],
                "_unit_price": prod["price"],
                "_category": prod["cat"],
                "_subtotal": round(qty * prod["price"], 2),
                "_discount_amount": round(qty * prod["price"] * disc_pct, 2),
                "_net_total": round(qty * prod["price"] * (1 - disc_pct), 2),
                "_iva": round(qty * prod["price"] * 0.16, 2),
                "_final_total": round(round(qty * prod["price"], 2) + round(qty * prod["price"] * 0.16, 2), 2),
            })

        return {
            "type": "vlookup_catalog_pricing",
            "catalog": catalog,
            "transactions": transactions,
        }

    @classmethod
    def _gen_logic_kpis(cls, rng: random.Random, pack: dict[str, Any], count: int) -> dict[str, Any]:
        agents = pack.get("agents", ["Colaborador 1", "Colaborador 2", "Colaborador 3"])
        locations = pack.get("locations", ["Sucursal 1", "Sucursal 2"])
        
        rows = []
        for i in range(1, count + 1):
            employee_id = f"EMP-{500 + i}"
            name = rng.choice(agents) if i > len(agents) else agents[i - 1]
            branch = rng.choice(locations)
            
            target_val = rng.choice([50000.0, 75000.0, 100000.0, 120000.0, 150000.0])
            performance_ratio = rng.uniform(0.55, 1.35)
            actual_val = round(target_val * performance_ratio, 2)
            
            ratio = actual_val / target_val
            pct = round(ratio * 100, 2)
            
            if pct >= 100.0:
                status_label = "CUMPLIDO"
                bonus = 5000.0
            elif pct >= 80.0:
                status_label = "REGULAR"
                bonus = 2000.0
            else:
                status_label = "DEFICIENTE"
                bonus = 0.0

            rows.append({
                "ID_EMPLEADO": employee_id,
                "NOMBRE": name,
                "SUCURSAL": branch,
                "META_ASIGNADA": target_val,
                "LOGRO_REAL": actual_val,
                "_pct_cumplimiento": ratio,
                "_pct_display": pct,
                "_estatus": status_label,
                "_bono": bonus,
            })

        return {
            "type": "logic_kpi_evaluation",
            "rows": rows,
        }

    @classmethod
    def _gen_audit_reconciliation(cls, rng: random.Random, pack: dict[str, Any], count: int) -> dict[str, Any]:
        products = pack.get("products", [
            {"code": "ART-01", "name": "Artículo Muestra", "price": 500.0}
        ])
        
        rows = []
        for i in range(1, count + 1):
            prod = rng.choice(products)
            item_code = f"{prod['code']}-{100 + i}"
            unit_cost = round(prod["price"] * 0.65, 2)
            
            system_stock = rng.randint(20, 300)
            
            # Generar discrepancia en ~40% de los casos
            discrepancy_type = rng.choice(["none", "none", "none", "faltante", "sobrante"])
            if discrepancy_type == "none":
                physical_stock = system_stock
            elif discrepancy_type == "faltante":
                physical_stock = system_stock - rng.randint(1, min(15, system_stock))
            else:
                physical_stock = system_stock + rng.randint(1, 20)

            diff_units = physical_stock - system_stock
            diff_amount = round(diff_units * unit_cost, 2)
            
            if diff_units == 0:
                dictamen = "CUADRADO"
            elif diff_units > 0:
                dictamen = "SOBRANTE"
            else:
                dictamen = "FALTANTE"

            rows.append({
                "CODIGO": item_code,
                "DESCRIPCION": prod["name"],
                "COSTO_UNITARIO": unit_cost,
                "REGISTRO_SISTEMA": system_stock,
                "CONTEO_FISICO": physical_stock,
                "_diff_units": diff_units,
                "_diff_amount": diff_amount,
                "_dictamen": dictamen,
            })

        return {
            "type": "audit_reconciliation",
            "rows": rows,
        }
