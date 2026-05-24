<?php
/**
 * NominasEDU — Crear / Ver / Editar una nómina
 *
 * @package NominasEDU
 */

$res = 0;
if (!$res && file_exists("../../main.inc.php"))   { $res = @include "../../main.inc.php"; }
if (!$res && file_exists("../../../main.inc.php")) { $res = @include "../../../main.inc.php"; }
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/class/html.form.class.php';
dol_include_once('/nominasedu/lib/nominasedu.lib.php');

$langs->loadLangs(array("nominasedu@nominasedu", "companies", "bills"));

$id      = GETPOST('id',      'int');
$action  = GETPOST('action',  'aZ09');
$confirm = GETPOST('confirm', 'alpha');

if (!isModEnabled('nominasedu')) { accessforbidden('Module nominasedu not enabled'); }
if (!$user->hasRight('nominasedu', 'read')) { accessforbidden(); }

$form = new Form($db);

$year       = GETPOST('year',        'int')    ?: (int)date('Y');
$month      = GETPOST('month',       'int')    ?: (int)date('m');
$fkEmployee = GETPOST('fk_employee', 'int');
$grossInput = GETPOST('gross_salary','alpha');
$extraInput = GETPOST('extra_pay',   'alpha');
$irpfInput  = GETPOST('irpf_rate',   'alpha');

$error   = '';
$message = '';
$payroll = null;

// ── Carga de registro existente ───────────────────────────────────────────────
if ($id > 0 && $action != 'create') {
    $payroll = nominasedu_get_payroll($db, $id, $conf->entity);
    if (!$payroll) {
        setEventMessages($langs->trans("NominaNoEncontrada"), null, 'errors');
        header('Location: '.DOL_URL_ROOT.'/nominasedu/index.php');
        exit;
    }
}

// ── ACCIONES ──────────────────────────────────────────────────────────────────

// Guardar nueva nómina
if ($action == 'add' && $user->hasRight('nominasedu', 'write')) {
    $gross = (float)str_replace(',', '.', $grossInput);
    $extra = (float)str_replace(',', '.', $extraInput);
    $irpf  = (float)str_replace(',', '.', $irpfInput);

    if (!$fkEmployee) { $error = $langs->trans("EmpleadoRequerido"); }
    elseif (!$year || !$month) { $error = $langs->trans("PeriodoRequerido"); }
    elseif ($gross <= 0) { $error = $langs->trans("SalarioRequerido"); }

    if (!$error) {
        $calc = nominasedu_calcula_nomina($gross, $irpf, $extra);

        $sql  = "INSERT INTO ".MAIN_DB_PREFIX."nominasedu_payroll";
        $sql .= " (entity, fk_employee, period_year, period_month, gross_salary, extra_pay,";
        $sql .= "  irpf_rate, irpf_amount, ss_employee, ss_employer, net_salary, status, date_creation)";
        $sql .= " VALUES (";
        $sql .= $conf->entity.",".$fkEmployee.",".$year.",".$month.",";
        $sql .= $calc['base'].",".$extra.",".$irpf.",";
        $sql .= $calc['irpf'].",".$calc['ss_obrero'].",".$calc['ss_empresa'].",";
        $sql .= $calc['neto'].",0,NOW())";

        $resql = $db->query($sql);
        if ($resql) {
            $newId = $db->last_insert_id(MAIN_DB_PREFIX."nominasedu_payroll");
            setEventMessages($langs->trans("NominaCreada"), null, 'mesgs');
            header('Location: '.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$newId);
            exit;
        } else {
            $error = $db->lasterror();
        }
    }
}

// Validar nómina
if ($action == 'confirm_validate' && $confirm == 'yes' && $id > 0 && $user->hasRight('nominasedu', 'write')) {
    $sql = "UPDATE ".MAIN_DB_PREFIX."nominasedu_payroll SET status=1, tms=NOW()";
    $sql .= " WHERE rowid=".((int)$id)." AND entity=".((int)$conf->entity);
    if ($db->query($sql)) {
        setEventMessages($langs->trans("NominaValidadaOK"), null, 'mesgs');
    }
    header('Location: '.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$id);
    exit;
}

// Anular validación
if ($action == 'anular' && $id > 0 && $user->hasRight('nominasedu', 'write')) {
    $sql = "UPDATE ".MAIN_DB_PREFIX."nominasedu_payroll SET status=0, tms=NOW()";
    $sql .= " WHERE rowid=".((int)$id)." AND entity=".((int)$conf->entity);
    if ($db->query($sql)) {
        setEventMessages($langs->trans("NominaActualizada"), null, 'mesgs');
    }
    header('Location: '.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$id);
    exit;
}

// Eliminar nómina
if ($action == 'confirm_delete' && $confirm == 'yes' && $id > 0 && $user->hasRight('nominasedu', 'delete')) {
    $sql = "DELETE FROM ".MAIN_DB_PREFIX."nominasedu_payroll";
    $sql .= " WHERE rowid=".((int)$id)." AND entity=".((int)$conf->entity)." AND status=0";
    if ($db->query($sql)) {
        setEventMessages($langs->trans("NominaEliminada"), null, 'mesgs');
        header('Location: '.DOL_URL_ROOT.'/nominasedu/index.php');
        exit;
    } else {
        $error = $db->lasterror();
    }
}

// ── Carga de empleados para el selector ──────────────────────────────────────
$empleados = array();
$sqlEmp  = "SELECT e.rowid, u.firstname, u.lastname, u.login, e.base_salary, e.irpf_rate";
$sqlEmp .= " FROM ".MAIN_DB_PREFIX."nominasedu_employee AS e";
$sqlEmp .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
$sqlEmp .= " WHERE e.entity=".((int)$conf->entity)." AND e.active=1";
$sqlEmp .= " ORDER BY u.lastname, u.firstname";
$rEmp = $db->query($sqlEmp);
if ($rEmp) {
    while ($o = $db->fetch_object($rEmp)) { $empleados[] = $o; }
    $db->free($rEmp);
}

// ── VIEW ──────────────────────────────────────────────────────────────────────
$meses = array(
    1=>'Enero',2=>'Febrero',3=>'Marzo',4=>'Abril',5=>'Mayo',6=>'Junio',
    7=>'Julio',8=>'Agosto',9=>'Septiembre',10=>'Octubre',11=>'Noviembre',12=>'Diciembre'
);

$titulo = ($action == 'create' || !$payroll)
    ? $langs->trans("NuevaNomina")
    : $langs->trans("NominaDelMes").' — '.($meses[$payroll->period_month] ?? '').' '.$payroll->period_year;

llxHeader('', $titulo, '');

$head = nominasedu_prepare_head();
print dol_get_fiche_head($head, 'list', $langs->trans("NominasEDU"), -1, 'salary');

// Título con migas de pan
$linkback = '<a href="'.DOL_URL_ROOT.'/nominasedu/index.php">'.$langs->trans("ListaNominas").'</a>';
print load_fiche_titre($titulo, $linkback, 'salary');

if ($error) {
    setEventMessages($error, null, 'errors');
}

// ── FORMULARIO DE CREACIÓN ────────────────────────────────────────────────────
if ($action == 'create' || !$payroll) {
    print '<form action="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php" method="post">';
    print '<input type="hidden" name="token" value="'.newToken().'">';
    print '<input type="hidden" name="action" value="add">';

    print dol_get_fiche_head(array(), '', '', -1);
    print '<table class="border centpercent tableforfield">';

    // Empleado
    print '<tr><td class="titlefield fieldrequired">'.$langs->trans("NombreEmpleado").'</td>';
    print '<td>';
    print '<select name="fk_employee" id="fk_employee" class="flat quatrevingtpercent" onchange="fillFromEmployee(this)">';
    print '<option value="">'.$langs->trans("SeleccionaEmpleado").'</option>';
    foreach ($empleados as $e) {
        $sel = ($fkEmployee == $e->rowid) ? ' selected' : '';
        $label = htmlspecialchars($e->lastname.' '.$e->firstname.' ('.$e->login.')');
        print '<option value="'.$e->rowid.'" data-salary="'.htmlspecialchars($e->base_salary).'" data-irpf="'.htmlspecialchars($e->irpf_rate).'"'.$sel.'>'.$label.'</option>';
    }
    print '</select></td></tr>';

    // Período
    print '<tr><td class="fieldrequired">'.$langs->trans("Periodo").'</td><td>';
    print '<select name="month" class="flat" style="width:140px">';
    foreach ($meses as $m => $nombre) {
        print '<option value="'.$m.'"'.($m == $month ? ' selected' : '').'>'.$nombre.'</option>';
    }
    print '</select> ';
    print '<select name="year" class="flat" style="width:80px">';
    for ($y = (int)date('Y') + 1; $y >= 2020; $y--) {
        print '<option value="'.$y.'"'.($y == $year ? ' selected' : '').'>'.$y.'</option>';
    }
    print '</select></td></tr>';

    // Salario bruto
    print '<tr><td class="fieldrequired">'.$langs->trans("SalarioBase").' (€)</td>';
    print '<td><input type="number" name="gross_salary" id="gross_salary" class="flat maxwidth100" step="0.01" min="0" value="'.htmlspecialchars($grossInput).'" onchange="recalcular()"></td></tr>';

    // Complementos / pagas extra
    print '<tr><td>'.$langs->trans("PagasExtra").' (€)</td>';
    print '<td><input type="number" name="extra_pay" id="extra_pay" class="flat maxwidth100" step="0.01" min="0" value="'.htmlspecialchars($extraInput).'" onchange="recalcular()"></td></tr>';

    // IRPF
    print '<tr><td class="fieldrequired">'.$langs->trans("PorcentajeIRPF").'</td>';
    print '<td><input type="number" name="irpf_rate" id="irpf_rate" class="flat maxwidth75" step="0.01" min="0" max="50" value="'.htmlspecialchars($irpfInput ?: '15').'" onchange="recalcular()"> %</td></tr>';

    print '</table>';

    // ── Cuadro de desglose (se actualiza en tiempo real con JS) ───────────────
    print '<br>';
    print '<div id="desglose" class="fichecenter" style="display:none">';
    print '<div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">'.$langs->trans("NuevaNomina").' — '.$langs->trans("Desglose").'</th></tr>';
    print '<tr><td>'.$langs->trans("SalarioBruto").'</td><td class="right" id="r_bruto">—</td></tr>';
    print '<tr><td>'.$langs->trans("RetencionIRPF").' (<span id="r_irpf_pct">0</span>%)</td><td class="right" id="r_irpf">—</td></tr>';
    print '<tr><td>'.$langs->trans("CuotaObreroSS").' (6,47%)</td><td class="right" id="r_ss_obr">—</td></tr>';
    print '<tr class="liste_total"><td><b>'.$langs->trans("SalarioNeto").'</b></td><td class="right" id="r_neto"><b>—</b></td></tr>';
    print '<tr><td>'.$langs->trans("CuotaEmpresaSS").' (30,48%)</td><td class="right" id="r_ss_emp">—</td></tr>';
    print '<tr class="liste_total"><td><b>'.$langs->trans("CosteTotalEmpresa").'</b></td><td class="right" id="r_coste"><b>—</b></td></tr>';
    print '</table></div></div>';

    print dol_get_fiche_end();

    print '<div class="tabsAction">';
    print '<input type="submit" class="butAction" value="'.$langs->trans("Guardar").'">';
    print '<a class="butActionDelete" href="'.DOL_URL_ROOT.'/nominasedu/index.php">'.$langs->trans("Annuler").'</a>';
    print '</div>';
    print '</form>';

    // JS de recálculo en tiempo real
    print '
<script>
function fmt(n) {
    return n.toLocaleString("es-ES", {minimumFractionDigits:2, maximumFractionDigits:2}) + " €";
}
function fillFromEmployee(sel) {
    var opt = sel.options[sel.selectedIndex];
    if (!opt.value) return;
    document.getElementById("gross_salary").value = parseFloat(opt.dataset.salary || 0).toFixed(2);
    document.getElementById("irpf_rate").value    = parseFloat(opt.dataset.irpf  || 15).toFixed(2);
    recalcular();
}
function recalcular() {
    var bruto = parseFloat(document.getElementById("gross_salary").value || 0);
    var extra = parseFloat(document.getElementById("extra_pay").value    || 0);
    var irpf  = parseFloat(document.getElementById("irpf_rate").value   || 0);
    var base = bruto + extra;
    if (base <= 0) { document.getElementById("desglose").style.display="none"; return; }
    var ssObr = Math.round(base * 6.47) / 100;
    var ssEmp = Math.round(base * 30.48) / 100;
    var retIRPF = Math.round(base * irpf * 100) / 10000;
    var neto  = Math.round((base - ssObr - retIRPF) * 100) / 100;
    var coste = Math.round((base + ssEmp) * 100) / 100;
    document.getElementById("r_bruto").textContent    = fmt(base);
    document.getElementById("r_irpf_pct").textContent = irpf.toFixed(2);
    document.getElementById("r_irpf").textContent     = fmt(retIRPF);
    document.getElementById("r_ss_obr").textContent   = fmt(ssObr);
    document.getElementById("r_neto").innerHTML       = "<b>" + fmt(neto) + "</b>";
    document.getElementById("r_ss_emp").textContent   = fmt(ssEmp);
    document.getElementById("r_coste").innerHTML      = "<b>" + fmt(coste) + "</b>";
    document.getElementById("desglose").style.display = "";
}
document.addEventListener("DOMContentLoaded", recalcular);
</script>';

} else {
    // ── VISTA DETALLE ─────────────────────────────────────────────────────────
    $calc = nominasedu_calcula_nomina($payroll->gross_salary, $payroll->irpf_rate, $payroll->extra_pay);
    $mesNombre = $meses[$payroll->period_month] ?? '';

    // Diálogo confirmación validar
    if ($action == 'validate') {
        print $form->formconfirm(
            DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$payroll->rowid,
            $langs->trans("ValidarNomina"),
            $langs->trans("ConfirmarValidar"),
            'confirm_validate',
            '',
            'yes',
            1
        );
    }
    // Diálogo confirmación eliminar
    if ($action == 'delete') {
        print $form->formconfirm(
            DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$payroll->rowid,
            $langs->trans("EliminarNomina"),
            $langs->trans("ConfirmarEliminarNomina"),
            'confirm_delete',
            '',
            'yes',
            1
        );
    }

    print '<div class="fichecenter"><div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">'.$langs->trans("Empleado").'</th></tr>';
    print '<tr><td class="titlefield">'.$langs->trans("NombreEmpleado").'</td>';
    print '<td><b>'.dol_escape_htmltag($payroll->firstname.' '.$payroll->lastname).'</b></td></tr>';
    print '<tr><td>'.$langs->trans("UsuarioDolibarr").'</td>';
    print '<td><span class="badge userimg">'.dol_escape_htmltag($payroll->login).'</span></td></tr>';
    print '<tr><td>'.$langs->trans("Periodo").'</td>';
    print '<td><b>'.$mesNombre.' '.$payroll->period_year.'</b></td></tr>';
    print '<tr><td>'.$langs->trans("EstadoNomina").'</td>';
    print '<td>'.nominasedu_badge_estado($payroll->status).'</td></tr>';
    print '</table>';
    print '</div>';

    print '<div class="fichetwothirdright">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">'.$langs->trans("Desglose").'</th></tr>';

    print '<tr><td class="titlefield">'.$langs->trans("SalarioBase").'</td>';
    print '<td class="right">'.price($payroll->gross_salary).' €</td></tr>';

    if ($payroll->extra_pay > 0) {
        print '<tr><td>'.$langs->trans("PagasExtra").'</td>';
        print '<td class="right">'.price($payroll->extra_pay).' €</td></tr>';
    }

    print '<tr class="liste_total"><td><b>'.$langs->trans("SalarioBruto").'</b></td>';
    print '<td class="right"><b>'.price($payroll->gross_salary + $payroll->extra_pay).' €</b></td></tr>';

    print '<tr><td class="separatorinvoiceline" colspan="2"></td></tr>';

    print '<tr><td>'.$langs->trans("CuotaObreroSS").' ('.$calc['tasa_ss_obrero'].'%)</td>';
    print '<td class="right"><span class="opacitymedium">- '.price($payroll->ss_employee).' €</span></td></tr>';

    print '<tr><td>'.$langs->trans("RetencionIRPF").' ('.$payroll->irpf_rate.'%)</td>';
    print '<td class="right"><span class="opacitymedium">- '.price($payroll->irpf_amount).' €</span></td></tr>';

    print '<tr class="liste_total"><td><b>'.$langs->trans("SalarioNeto").'</b></td>';
    print '<td class="right colorblue"><b>'.price($payroll->net_salary).' €</b></td></tr>';

    print '<tr><td class="separatorinvoiceline" colspan="2"></td></tr>';

    print '<tr><td>'.$langs->trans("CuotaEmpresaSS").' ('.$calc['tasa_ss_empresa'].'%)</td>';
    print '<td class="right"><span class="opacitymedium">+ '.price($payroll->ss_employer).' €</span></td></tr>';

    print '<tr class="liste_total"><td><b>'.$langs->trans("CosteTotalEmpresa").'</b></td>';
    print '<td class="right"><b>'.price($payroll->gross_salary + $payroll->extra_pay + $payroll->ss_employer).' €</b></td></tr>';

    print '</table>';
    print '</div></div>'; // fichecenter

    // ── Desglose de tipos SS ──────────────────────────────────────────────────
    print '<br>';
    print '<div class="fichecenter"><div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th>'.$langs->trans("TiposSSObrero").'</th><th class="right">Tipo</th><th class="right">Importe</th></tr>';
    $base = $payroll->gross_salary + $payroll->extra_pay;
    foreach ($calc['detalle_obrero'] as $concepto => $tasa) {
        $nombres = array('cc'=>'Contingencias comunes','paro'=>'Desempleo','fp'=>'Formación prof.','mei'=>'MEI');
        print '<tr><td>'.($nombres[$concepto] ?? $concepto).'</td>';
        print '<td class="right">'.$tasa.'%</td>';
        print '<td class="right">'.price(round($base * $tasa / 100, 2)).' €</td></tr>';
    }
    print '<tr class="liste_total"><td><b>Total obrero</b></td><td class="right"><b>'.$calc['tasa_ss_obrero'].'%</b></td>';
    print '<td class="right"><b>'.price($payroll->ss_employee).' €</b></td></tr>';
    print '</table></div>';

    print '<div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th>'.$langs->trans("TiposSSEmpresa").'</th><th class="right">Tipo</th><th class="right">Importe</th></tr>';
    foreach ($calc['detalle_empresa'] as $concepto => $tasa) {
        $nombres = array('cc'=>'Contingencias comunes','paro'=>'Desempleo','fp'=>'Formación prof.','fogasa'=>'FOGASA','mei'=>'MEI');
        print '<tr><td>'.($nombres[$concepto] ?? $concepto).'</td>';
        print '<td class="right">'.$tasa.'%</td>';
        print '<td class="right">'.price(round($base * $tasa / 100, 2)).' €</td></tr>';
    }
    print '<tr class="liste_total"><td><b>Total empresa</b></td><td class="right"><b>'.$calc['tasa_ss_empresa'].'%</b></td>';
    print '<td class="right"><b>'.price($payroll->ss_employer).' €</b></td></tr>';
    print '</table></div></div>';

    // Botones de acción
    print '<div class="tabsAction">';
    if ($payroll->status == 0 && $user->hasRight('nominasedu', 'write')) {
        print '<a class="butAction" href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$payroll->rowid.'&action=validate&token='.newToken().'">'
            .$langs->trans("ValidarNomina").'</a>';
    }
    if ($payroll->status == 1 && $user->hasRight('nominasedu', 'write')) {
        print '<a class="butActionDelete" href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$payroll->rowid.'&action=anular&token='.newToken().'">'
            .$langs->trans("AnularNomina").'</a>';
    }
    if ($payroll->status == 0 && $user->hasRight('nominasedu', 'delete')) {
        print '<a class="butActionDelete" href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$payroll->rowid.'&action=delete&token='.newToken().'">'
            .$langs->trans("EliminarNomina").'</a>';
    }
    print '<a class="butActionRefused" href="'.DOL_URL_ROOT.'/nominasedu/index.php?year='.$payroll->period_year.'&month='.$payroll->period_month.'">'
        .$langs->trans("RetourListe").'</a>';
    print '</div>';
}

print dol_get_fiche_end();

llxFooter();
$db->close();
