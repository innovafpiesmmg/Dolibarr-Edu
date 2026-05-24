<?php
/**
 * NominasEDU — Liquidación de Seguridad Social e IRPF (Modelo 111)
 *
 * @package NominasEDU
 */

$res = 0;
if (!$res && file_exists("../../main.inc.php"))   { $res = @include "../../main.inc.php"; }
if (!$res && file_exists("../../../main.inc.php")) { $res = @include "../../../main.inc.php"; }
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/class/html.form.class.php';
dol_include_once('/nominasedu/lib/nominasedu.lib.php');

$langs->loadLangs(array("nominasedu@nominasedu", "companies", "banks"));

$year   = GETPOST('year',  'int') ?: (int)date('Y');
$month  = GETPOST('month', 'int') ?: (int)date('m');
$action = GETPOST('action', 'aZ09');

if (!isModEnabled('nominasedu')) { accessforbidden('Module nominasedu not enabled'); }
if (!$user->hasRight('nominasedu', 'read')) { accessforbidden(); }

$form = new Form($db);

$meses = array(
    1=>'Enero',2=>'Febrero',3=>'Marzo',4=>'Abril',5=>'Mayo',6=>'Junio',
    7=>'Julio',8=>'Agosto',9=>'Septiembre',10=>'Octubre',11=>'Noviembre',12=>'Diciembre'
);

// ── ACCIONES ──────────────────────────────────────────────────────────────────

// Registrar pago SS
if ($action == 'pay_ss' && $user->hasRight('nominasedu', 'write')) {
    $dateSS = GETPOST('date_ss_paid', 'alpha');
    // Upsert del registro de liquidación
    $sqlCheck = "SELECT rowid FROM ".MAIN_DB_PREFIX."nominasedu_ss_payment";
    $sqlCheck .= " WHERE entity=".((int)$conf->entity)." AND period_year=".((int)$year)." AND period_month=".((int)$month);
    $rCheck = $db->query($sqlCheck);
    $exists = $rCheck && $db->num_rows($rCheck) > 0 ? $db->fetch_object($rCheck) : null;

    if ($exists) {
        $sql = "UPDATE ".MAIN_DB_PREFIX."nominasedu_ss_payment SET ss_paid=1, date_ss_paid='".addslashes($dateSS)."', tms=NOW()";
        $sql .= " WHERE rowid=".((int)$exists->rowid);
    } else {
        // Calcular totales del período
        list($totSS, $totIRPF) = nominasedu_calcula_totales_ss($db, $conf->entity, $year, $month);
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."nominasedu_ss_payment";
        $sql .= " (entity, period_year, period_month, ss_total, irpf_total, ss_paid, date_ss_paid, date_creation)";
        $sql .= " VALUES (".((int)$conf->entity).",".((int)$year).",".((int)$month).",".$totSS.",".$totIRPF.",1,'".addslashes($dateSS)."',NOW())";
    }
    if ($db->query($sql)) {
        setEventMessages($langs->trans("LiquidacionActualizada"), null, 'mesgs');
    } else {
        setEventMessages($db->lasterror(), null, 'errors');
    }
    header('Location: '.DOL_URL_ROOT.'/nominasedu/ss.php?year='.$year.'&month='.$month);
    exit;
}

// Registrar pago IRPF
if ($action == 'pay_irpf' && $user->hasRight('nominasedu', 'write')) {
    $dateIRPF = GETPOST('date_irpf_paid', 'alpha');
    $sqlCheck = "SELECT rowid FROM ".MAIN_DB_PREFIX."nominasedu_ss_payment";
    $sqlCheck .= " WHERE entity=".((int)$conf->entity)." AND period_year=".((int)$year)." AND period_month=".((int)$month);
    $rCheck = $db->query($sqlCheck);
    $exists = $rCheck && $db->num_rows($rCheck) > 0 ? $db->fetch_object($rCheck) : null;

    if ($exists) {
        $sql = "UPDATE ".MAIN_DB_PREFIX."nominasedu_ss_payment SET irpf_paid=1, date_irpf_paid='".addslashes($dateIRPF)."', tms=NOW()";
        $sql .= " WHERE rowid=".((int)$exists->rowid);
    } else {
        list($totSS, $totIRPF) = nominasedu_calcula_totales_ss($db, $conf->entity, $year, $month);
        $sql = "INSERT INTO ".MAIN_DB_PREFIX."nominasedu_ss_payment";
        $sql .= " (entity, period_year, period_month, ss_total, irpf_total, irpf_paid, date_irpf_paid, date_creation)";
        $sql .= " VALUES (".((int)$conf->entity).",".((int)$year).",".((int)$month).",".$totSS.",".$totIRPF.",1,'".addslashes($dateIRPF)."',NOW())";
    }
    if ($db->query($sql)) {
        setEventMessages($langs->trans("LiquidacionActualizada"), null, 'mesgs');
    } else {
        setEventMessages($db->lasterror(), null, 'errors');
    }
    header('Location: '.DOL_URL_ROOT.'/nominasedu/ss.php?year='.$year.'&month='.$month);
    exit;
}

// ── Función auxiliar (dentro del mismo fichero para no romper el autoload) ────
function nominasedu_calcula_totales_ss($db, $entity, $year, $month)
{
    $sql  = "SELECT SUM(ss_employee + ss_employer) AS tot_ss, SUM(irpf_amount) AS tot_irpf";
    $sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_payroll";
    $sql .= " WHERE entity=".((int)$entity)." AND period_year=".((int)$year)." AND period_month=".((int)$month)." AND status=1";
    $r = $db->query($sql);
    if ($r) {
        $o = $db->fetch_object($r);
        return array((float)$o->tot_ss, (float)$o->tot_irpf);
    }
    return array(0, 0);
}

// ── Consulta totales de nóminas validadas del período ─────────────────────────
$sql  = "SELECT";
$sql .= "  COUNT(*) AS num_nominas,";
$sql .= "  SUM(gross_salary + extra_pay) AS tot_bruto,";
$sql .= "  SUM(net_salary)               AS tot_neto,";
$sql .= "  SUM(ss_employee)              AS tot_ss_obrero,";
$sql .= "  SUM(ss_employer)              AS tot_ss_empresa,";
$sql .= "  SUM(irpf_amount)              AS tot_irpf";
$sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_payroll";
$sql .= " WHERE entity=".((int)$conf->entity)." AND period_year=".((int)$year)." AND period_month=".((int)$month)." AND status=1";
$resql = $db->query($sql);
$totales = $resql ? $db->fetch_object($resql) : null;

// Registro de liquidación existente
$sqlSS  = "SELECT * FROM ".MAIN_DB_PREFIX."nominasedu_ss_payment";
$sqlSS .= " WHERE entity=".((int)$conf->entity)." AND period_year=".((int)$year)." AND period_month=".((int)$month);
$rSS = $db->query($sqlSS);
$liquidacion = ($rSS && $db->num_rows($rSS) > 0) ? $db->fetch_object($rSS) : null;

$totSS   = $totales ? (float)($totales->tot_ss_obrero + $totales->tot_ss_empresa) : 0;
$totIRPF = $totales ? (float)$totales->tot_irpf : 0;

// ── Nóminas del período (detalle) ─────────────────────────────────────────────
$sqlDet  = "SELECT p.rowid, p.gross_salary, p.extra_pay, p.ss_employee, p.ss_employer, p.irpf_amount, p.net_salary,";
$sqlDet .= " u.firstname, u.lastname";
$sqlDet .= " FROM ".MAIN_DB_PREFIX."nominasedu_payroll AS p";
$sqlDet .= " LEFT JOIN ".MAIN_DB_PREFIX."nominasedu_employee AS e ON e.rowid = p.fk_employee";
$sqlDet .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
$sqlDet .= " WHERE p.entity=".((int)$conf->entity)." AND p.period_year=".((int)$year)." AND p.period_month=".((int)$month)." AND p.status=1";
$sqlDet .= " ORDER BY u.lastname, u.firstname";
$rDet = $db->query($sqlDet);
$detalles = array();
if ($rDet) { while ($o = $db->fetch_object($rDet)) { $detalles[] = $o; } }

// ── VIEW ──────────────────────────────────────────────────────────────────────
llxHeader('', $langs->trans("LiquidacionSS"), '');

$head = nominasedu_prepare_head();
print dol_get_fiche_head($head, 'ss', $langs->trans("NominasEDU"), -1, 'salary');

print load_fiche_titre($langs->trans("LiquidacionSS"), '', 'bill');

// Filtro de período
print '<form method="get" action="'.DOL_URL_ROOT.'/nominasedu/ss.php" class="formfilter">';
print '<div class="divsearchfield">';
print '<label><b>'.$langs->trans("Periodo").':</b></label> ';
print '<select name="month" class="flat">';
foreach ($meses as $m => $nombre) {
    print '<option value="'.$m.'"'.($m == $month ? ' selected' : '').'>'.$nombre.'</option>';
}
print '</select> ';
print '<select name="year" class="flat">';
for ($y = (int)date('Y') + 1; $y >= 2020; $y--) {
    print '<option value="'.$y.'"'.($y == $year ? ' selected' : '').'>'.$y.'</option>';
}
print '</select> <input type="submit" class="button" value="'.$langs->trans("Filtrer").'">';
print '</div></form><br>';

// Encabezado del período
print '<div class="titre inline-block">'.($meses[$month] ?? '').' '.$year.'</div><br><br>';

if (!$totales || $totales->num_nominas == 0) {
    print '<div class="info">'.$langs->trans("SinNominasEnPeriodo").'</div>';
} else {
    // ── Resumen totales ───────────────────────────────────────────────────────
    print '<div class="fichecenter"><div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">Resumen del período — '.$totales->num_nominas.' nómina(s) validada(s)</th></tr>';

    print '<tr><td class="titlefield">'.$langs->trans("TotalMasaSalarial").'</td>';
    print '<td class="right"><b>'.price($totales->tot_bruto).' €</b></td></tr>';

    print '<tr><td class="titlefield">'.$langs->trans("CuotaObreroTotal").'</td>';
    print '<td class="right">'.price($totales->tot_ss_obrero).' €</td></tr>';

    print '<tr><td>'.$langs->trans("CuotaEmpresaTotal").'</td>';
    print '<td class="right">'.price($totales->tot_ss_empresa).' €</td></tr>';

    print '<tr class="liste_total"><td><b>'.$langs->trans("SSTotal").'</b></td>';
    print '<td class="right"><b>'.price($totSS).' €</b></td></tr>';

    print '<tr><td>'.$langs->trans("RetencionIRPF").' (Modelo 111)</td>';
    print '<td class="right"><b class="colorblue">'.price($totIRPF).' €</b></td></tr>';

    print '<tr class="liste_total"><td><b>Coste total empresa</b></td>';
    print '<td class="right"><b>'.price($totales->tot_bruto + $totales->tot_ss_empresa).' €</b></td></tr>';
    print '</table></div>';

    // ── Estado de liquidación ─────────────────────────────────────────────────
    print '<div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">Estado de liquidación</th></tr>';

    // SS
    $ssPagada  = $liquidacion && $liquidacion->ss_paid;
    print '<tr><td class="titlefield">'.$langs->trans("SSPagada").'</td><td>';
    if ($ssPagada) {
        print '<span class="badge badge-status4 badge-status">Pagada</span>';
        print ' <span class="opacitymedium">('.dol_print_date($db->jdate($liquidacion->date_ss_paid), 'day').')</span>';
    } else {
        print '<span class="badge badge-status8 badge-status">Pendiente</span>';
    }
    print '</td></tr>';

    // IRPF
    $irpfPagado = $liquidacion && $liquidacion->irpf_paid;
    print '<tr><td>'.$langs->trans("IRPFPagado").' (M.111)</td><td>';
    if ($irpfPagado) {
        print '<span class="badge badge-status4 badge-status">Pagado</span>';
        print ' <span class="opacitymedium">('.dol_print_date($db->jdate($liquidacion->date_irpf_paid), 'day').')</span>';
    } else {
        print '<span class="badge badge-status8 badge-status">Pendiente</span>';
    }
    print '</td></tr>';
    print '</table></div></div>'; // fichecenter

    // ── Formularios de pago ───────────────────────────────────────────────────
    if ($user->hasRight('nominasedu', 'write')) {
        print '<br><div class="fichecenter">';

        if (!$ssPagada) {
            print '<div class="fichethirdleft">';
            print '<form method="post" action="'.DOL_URL_ROOT.'/nominasedu/ss.php?year='.$year.'&month='.$month.'">';
            print '<input type="hidden" name="token" value="'.newToken().'">';
            print '<input type="hidden" name="action" value="pay_ss">';
            print '<table class="border centpercent tableforfield">';
            print '<tr class="liste_titre"><th colspan="2">Registrar pago SS — '.price($totSS).' €</th></tr>';
            print '<tr><td class="titlefield">'.$langs->trans("FechaPagoSS").'</td>';
            print '<td>'.$form->selectDate('', 'date_ss_paid', 0, 0, 0, '', 1).'</td></tr>';
            print '</table>';
            print '<div class="tabsAction">';
            print '<input type="submit" class="butAction" value="'.$langs->trans("MarcarSSPagada").'">';
            print '</div></form></div>';
        }

        if (!$irpfPagado) {
            print '<div class="fichethirdleft">';
            print '<form method="post" action="'.DOL_URL_ROOT.'/nominasedu/ss.php?year='.$year.'&month='.$month.'">';
            print '<input type="hidden" name="token" value="'.newToken().'">';
            print '<input type="hidden" name="action" value="pay_irpf">';
            print '<table class="border centpercent tableforfield">';
            print '<tr class="liste_titre"><th colspan="2">Registrar pago IRPF / Modelo 111 — '.price($totIRPF).' €</th></tr>';
            print '<tr><td class="titlefield">'.$langs->trans("FechaPagoIRPF").'</td>';
            print '<td>'.$form->selectDate('', 'date_irpf_paid', 0, 0, 0, '', 1).'</td></tr>';
            print '</table>';
            print '<div class="tabsAction">';
            print '<input type="submit" class="butAction butActionRefused" value="'.$langs->trans("MarcarIRPFPagado").'">';
            print '</div></form></div>';
        }

        print '</div>'; // fichecenter
    }

    // ── Detalle por empleado ──────────────────────────────────────────────────
    if (!empty($detalles)) {
        print '<br><div class="div-table-responsive">';
        print '<table class="tagtable nobottomiftotal liste centpercent">';
        print '<thead><tr class="liste_titre">';
        print '<th>'.$langs->trans("NombreEmpleado").'</th>';
        print '<th class="right">'.$langs->trans("SalarioBruto").'</th>';
        print '<th class="right">'.$langs->trans("CuotaObreroSS").'</th>';
        print '<th class="right">'.$langs->trans("CuotaEmpresaSS").'</th>';
        print '<th class="right">SS Total</th>';
        print '<th class="right">'.$langs->trans("RetencionIRPF").'</th>';
        print '<th class="right">'.$langs->trans("SalarioNeto").'</th>';
        print '</tr></thead><tbody>';
        foreach ($detalles as $d) {
            $bruto = $d->gross_salary + $d->extra_pay;
            $ssTot = $d->ss_employee + $d->ss_employer;
            print '<tr class="oddeven">';
            print '<td><a href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$d->rowid.'">'.dol_escape_htmltag($d->lastname.' '.$d->firstname).'</a></td>';
            print '<td class="right">'.price($bruto).'</td>';
            print '<td class="right"><span class="opacitymedium">'.price($d->ss_employee).'</span></td>';
            print '<td class="right"><span class="opacitymedium">'.price($d->ss_employer).'</span></td>';
            print '<td class="right">'.price($ssTot).'</td>';
            print '<td class="right"><span class="opacitymedium">'.price($d->irpf_amount).'</span></td>';
            print '<td class="right colorblue"><b>'.price($d->net_salary).'</b></td>';
            print '</tr>';
        }
        print '<tfoot><tr class="liste_total">';
        print '<td><b>Total</b></td>';
        print '<td class="right"><b>'.price($totales->tot_bruto).'</b></td>';
        print '<td class="right">'.price($totales->tot_ss_obrero).'</td>';
        print '<td class="right">'.price($totales->tot_ss_empresa).'</td>';
        print '<td class="right"><b>'.price($totSS).'</b></td>';
        print '<td class="right">'.price($totIRPF).'</td>';
        print '<td class="right colorblue"><b>'.price($totales->tot_neto).'</b></td>';
        print '</tr></tfoot>';
        print '</tbody></table></div>';
    }
}

print dol_get_fiche_end();

llxFooter();
$db->close();
