<?php
/**
 * Funciones auxiliares del módulo NominasEDU
 *
 * @package NominasEDU
 */

/**
 * Construye el array de migas de pan para las páginas del módulo.
 */
function nominasedu_prepare_head()
{
    global $langs, $conf, $db, $user;
    $langs->load("nominasedu@nominasedu");

    $h = 0;
    $head = array();

    $head[$h][0] = DOL_URL_ROOT.'/nominasedu/index.php';
    $head[$h][1] = $langs->trans("ListaNominas");
    $head[$h][2] = 'list';
    $h++;

    $head[$h][0] = DOL_URL_ROOT.'/nominasedu/empleados.php';
    $head[$h][1] = $langs->trans("Empleados");
    $head[$h][2] = 'empleados';
    $h++;

    $head[$h][0] = DOL_URL_ROOT.'/nominasedu/ss.php';
    $head[$h][1] = $langs->trans("LiquidacionSS");
    $head[$h][2] = 'ss';
    $h++;

    complete_head_from_modules($conf, $langs, null, $head, $h, 'nominasedu');

    complete_head_from_modules($conf, $langs, null, $head, $h, 'nominasedu', 'remove');

    return $head;
}

/**
 * Calcula todos los conceptos de una nómina a partir del salario bruto.
 *
 * @param  float $salarioBruto  Salario bruto mensual (incluye complementos)
 * @param  float $irpfRate      Tipo de retención IRPF en porcentaje (ej: 15)
 * @param  float $extraPay      Paga extra u otros complementos adicionales
 * @return array
 */
function nominasedu_calcula_nomina($salarioBruto, $irpfRate, $extraPay = 0)
{
    // Tipos de cotización SS — Régimen General 2024
    $SS_CC_OBR   = 4.70;   // Contingencias comunes obrero
    $SS_PARO_OBR = 1.55;   // Desempleo obrero
    $SS_FP_OBR   = 0.10;   // Formación profesional obrero
    $SS_MEI_OBR  = 0.12;   // MEI obrero
    $SS_TOTAL_OBR = $SS_CC_OBR + $SS_PARO_OBR + $SS_FP_OBR + $SS_MEI_OBR; // 6.47 %

    $SS_CC_EMP   = 23.60;  // Contingencias comunes empresa
    $SS_PARO_EMP = 5.50;   // Desempleo empresa
    $SS_FP_EMP   = 0.60;   // Formación profesional empresa
    $SS_FOG_EMP  = 0.20;   // FOGASA
    $SS_MEI_EMP  = 0.58;   // MEI empresa
    $SS_TOTAL_EMP = $SS_CC_EMP + $SS_PARO_EMP + $SS_FP_EMP + $SS_FOG_EMP + $SS_MEI_EMP; // 30.48 %

    $base = round((float)$salarioBruto + (float)$extraPay, 2);

    $ssObrero   = round($base * $SS_TOTAL_OBR / 100, 2);
    $ssEmpresa  = round($base * $SS_TOTAL_EMP / 100, 2);
    $irpf       = round($base * (float)$irpfRate / 100, 2);
    $neto       = round($base - $ssObrero - $irpf, 2);
    $costeTotal = round($base + $ssEmpresa, 2);

    return array(
        'base'           => $base,
        'ss_obrero'      => $ssObrero,
        'ss_empresa'     => $ssEmpresa,
        'irpf'           => $irpf,
        'neto'           => $neto,
        'coste_empresa'  => $costeTotal,
        'tasa_ss_obrero' => $SS_TOTAL_OBR,
        'tasa_ss_empresa' => $SS_TOTAL_EMP,
        'detalle_obrero' => array(
            'cc'  => $SS_CC_OBR,
            'paro' => $SS_PARO_OBR,
            'fp'  => $SS_FP_OBR,
            'mei' => $SS_MEI_OBR,
        ),
        'detalle_empresa' => array(
            'cc'    => $SS_CC_EMP,
            'paro'  => $SS_PARO_EMP,
            'fp'    => $SS_FP_EMP,
            'fogasa' => $SS_FOG_EMP,
            'mei'   => $SS_MEI_EMP,
        ),
    );
}

/**
 * Devuelve el nombre del mes en español.
 */
function nominasedu_nombre_mes($mes)
{
    $meses = array(
        1  => 'Enero', 2  => 'Febrero', 3  => 'Marzo',
        4  => 'Abril', 5  => 'Mayo',    6  => 'Junio',
        7  => 'Julio', 8  => 'Agosto',  9  => 'Septiembre',
        10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    );
    return isset($meses[(int)$mes]) ? $meses[(int)$mes] : '';
}

/**
 * Muestra el badge de estado de una nómina.
 */
function nominasedu_badge_estado($status)
{
    if ($status == 1) {
        return '<span class="badge badge-status4 badge-status">Validada</span>';
    }
    return '<span class="badge badge-status0 badge-status">Borrador</span>';
}

/**
 * Obtiene el empleado y el usuario Dolibarr vinculado por rowid de empleado.
 */
function nominasedu_get_employee($db, $id, $entity)
{
    $sql  = "SELECT e.rowid, e.fk_user, e.employee_type, e.base_salary, e.ss_group,";
    $sql .= " e.irpf_rate, e.active, u.firstname, u.lastname, u.login, u.email";
    $sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_employee AS e";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
    $sql .= " WHERE e.rowid = ".((int)$id)." AND e.entity = ".((int)$entity);
    $res = $db->query($sql);
    if ($res && $db->num_rows($res)) {
        return $db->fetch_object($res);
    }
    return null;
}

/**
 * Obtiene una nómina por rowid.
 */
function nominasedu_get_payroll($db, $id, $entity)
{
    $sql  = "SELECT p.*, e.fk_user, u.firstname, u.lastname, u.login";
    $sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_payroll AS p";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."nominasedu_employee AS e ON e.rowid = p.fk_employee";
    $sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
    $sql .= " WHERE p.rowid = ".((int)$id)." AND p.entity = ".((int)$entity);
    $res = $db->query($sql);
    if ($res && $db->num_rows($res)) {
        return $db->fetch_object($res);
    }
    return null;
}
