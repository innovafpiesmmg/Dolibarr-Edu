<?php
/**
 * NominasEDU — Lista de nóminas del período seleccionado
 *
 * @package NominasEDU
 */

$res = 0;
if (!$res && file_exists("../../main.inc.php"))   { $res = @include "../../main.inc.php"; }
if (!$res && file_exists("../../../main.inc.php")) { $res = @include "../../../main.inc.php"; }
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/class/html.form.class.php';
dol_include_once('/nominasedu/lib/nominasedu.lib.php');

$langs->loadLangs(array("nominasedu@nominasedu", "companies"));

// Parámetros
$year  = GETPOST('year',  'int') ?: (int)date('Y');
$month = GETPOST('month', 'int') ?: (int)date('m');

// Seguridad
if (!isModEnabled('nominasedu')) {
    accessforbidden('Module nominasedu not enabled');
}
if (!$user->hasRight('nominasedu', 'read')) {
    accessforbidden();
}

$form = new Form($db);

// ── VIEW ──────────────────────────────────────────────────────────────────────
$meses = array(
    1=>'Enero',2=>'Febrero',3=>'Marzo',4=>'Abril',5=>'Mayo',6=>'Junio',
    7=>'Julio',8=>'Agosto',9=>'Septiembre',10=>'Octubre',11=>'Noviembre',12=>'Diciembre'
);

$newCardLink = '';
if ($user->hasRight('nominasedu', 'write')) {
    $newCardLink = '<a class="butActionNew" href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?action=create">'
        .'<span class="fas fa-plus-circle valignmiddle paddingright" title=""></span>'
        .$langs->trans("NuevaNomina").'</a>';
}

llxHeader('', $langs->trans("NominasEDU"), '');

print load_fiche_titre($langs->trans("NominasEDU"), $newCardLink, 'salary');

// Pestañas de navegación del módulo
$head = nominasedu_prepare_head();
print dol_get_fiche_head($head, 'list', $langs->trans("NominasEDU"), -1, 'salary');

// ── Filtro de período ─────────────────────────────────────────────────────────
print '<form method="get" action="'.DOL_URL_ROOT.'/nominasedu/index.php" class="formfilter">';
print '<div class="divsearchfield">';
print '<label for="month"><b>'.$langs->trans("Periodo").':</b></label> ';
print '<select name="month" id="month" class="flat">';
foreach ($meses as $m => $nombre) {
    print '<option value="'.$m.'"'.($m == $month ? ' selected' : '').'>'.$nombre.'</option>';
}
print '</select>';
print ' ';
print '<select name="year" id="year" class="flat">';
for ($y = (int)date('Y') + 1; $y >= 2020; $y--) {
    print '<option value="'.$y.'"'.($y == $year ? ' selected' : '').'>'.$y.'</option>';
}
print '</select>';
print ' <input type="submit" class="button" value="'.$langs->trans("Filtrer").'">';
print '</div></form><br>';

// ── Consulta de nóminas ───────────────────────────────────────────────────────
$sql  = "SELECT p.rowid, p.fk_employee, p.period_year, p.period_month,";
$sql .= "  p.gross_salary, p.extra_pay, p.irpf_rate, p.irpf_amount,";
$sql .= "  p.ss_employee, p.ss_employer, p.net_salary, p.status,";
$sql .= "  u.firstname, u.lastname, u.login";
$sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_payroll AS p";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."nominasedu_employee AS e ON e.rowid = p.fk_employee";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
$sql .= " WHERE p.entity = ".((int)$conf->entity);
$sql .= "   AND p.period_year = ".((int)$year);
$sql .= "   AND p.period_month = ".((int)$month);
$sql .= " ORDER BY u.lastname ASC, u.firstname ASC";

$resql = $db->query($sql);
$rows  = array();
if ($resql) {
    while ($obj = $db->fetch_object($resql)) {
        $rows[] = $obj;
    }
    $db->free($resql);
}

// Totales
$totBruto = 0; $totNeto = 0; $totSSEmpresa = 0; $totIRPF = 0;
foreach ($rows as $r) {
    $totBruto    += $r->gross_salary + $r->extra_pay;
    $totNeto     += $r->net_salary;
    $totSSEmpresa += $r->ss_employer;
    $totIRPF     += $r->irpf_amount;
}

// ── Tabla ─────────────────────────────────────────────────────────────────────
print '<div class="div-table-responsive">';
print '<table class="tagtable nobottomiftotal liste centpercent">';
print '<thead><tr class="liste_titre">';
print '<th class="liste_titre">'.$langs->trans("NombreEmpleado").'</th>';
print '<th class="liste_titre">'.$langs->trans("UsuarioDolibarr").'</th>';
print '<th class="liste_titre right">'.$langs->trans("SalarioBruto").'</th>';
print '<th class="liste_titre right">'.$langs->trans("RetencionIRPF").'</th>';
print '<th class="liste_titre right">'.$langs->trans("CuotaObreroSS").'</th>';
print '<th class="liste_titre right">'.$langs->trans("SalarioNeto").'</th>';
print '<th class="liste_titre right">'.$langs->trans("CuotaEmpresaSS").'</th>';
print '<th class="liste_titre center">'.$langs->trans("EstadoNomina").'</th>';
print '<th class="liste_titre"></th>';
print '</tr></thead>';
print '<tbody>';

if (empty($rows)) {
    print '<tr class="oddeven"><td colspan="9" class="center opacitymedium">';
    print $langs->trans("NoHayNominas").' — '.strtolower($meses[$month]).' '.$year;
    if ($user->hasRight('nominasedu', 'write')) {
        print ' &nbsp; <a href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?action=create">'
            .$langs->trans("NuevaNomina").'</a>';
    }
    print '</td></tr>';
} else {
    $i = 0;
    foreach ($rows as $r) {
        print '<tr class="oddeven">';
        print '<td><a href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$r->rowid.'">'.dol_escape_htmltag($r->firstname.' '.$r->lastname).'</a></td>';
        print '<td class="tdoverflowmax100"><span class="opacitymedium">'.dol_escape_htmltag($r->login).'</span></td>';
        print '<td class="right nowrap"><b>'.price($r->gross_salary + $r->extra_pay).'</b></td>';
        print '<td class="right nowrap"><span class="opacitymedium">'.price($r->irpf_amount).'</span></td>';
        print '<td class="right nowrap"><span class="opacitymedium">'.price($r->ss_employee).'</span></td>';
        print '<td class="right nowrap"><b class="colorblue">'.price($r->net_salary).'</b></td>';
        print '<td class="right nowrap"><span class="opacitymedium">'.price($r->ss_employer).'</span></td>';
        print '<td class="center">'.nominasedu_badge_estado($r->status).'</td>';
        print '<td class="right">';
        print '<a class="editfielda marginleftonlyshort" href="'.DOL_URL_ROOT.'/nominasedu/nomina_card.php?id='.$r->rowid.'">';
        print '<span class="fas fa-eye" title="'.$langs->trans("Voir").'"></span></a>';
        print '</td>';
        print '</tr>';
        $i++;
    }
}

print '</tbody>';

// Fila de totales
if (!empty($rows)) {
    print '<tfoot><tr class="liste_total">';
    print '<td colspan="2"><b>'.$langs->trans("Total").' ('.$i.' '.strtolower($langs->trans("TotalNominas")).')</b></td>';
    print '<td class="right"><b>'.price($totBruto).'</b></td>';
    print '<td class="right">'.price($totIRPF).'</td>';
    print '<td class="right"></td>';
    print '<td class="right"><b class="colorblue">'.price($totNeto).'</b></td>';
    print '<td class="right">'.price($totSSEmpresa).'</td>';
    print '<td colspan="2"></td>';
    print '</tr></tfoot>';
}

print '</table></div>';

// ── Resumen financiero ────────────────────────────────────────────────────────
if (!empty($rows)) {
    print '<div class="fichecenter"><div class="fichethirdleft">';
    print '<table class="border centpercent tableforfield">';
    print '<tr><td class="titlefield">'.$langs->trans("TotalMasaSalarial").'</td>';
    print '<td class="right"><b>'.price($totBruto).' €</b></td></tr>';
    print '<tr><td>'.$langs->trans("TotalNetos").'</td>';
    print '<td class="right colorblue"><b>'.price($totNeto).' €</b></td></tr>';
    print '<tr><td>'.$langs->trans("TotalCosteSS").' (empresa)</td>';
    print '<td class="right">'.price($totSSEmpresa).' €</td></tr>';
    print '<tr><td><b>'.$langs->trans("TotalCosteMes").'</b></td>';
    print '<td class="right"><b>'.price($totBruto + $totSSEmpresa).' €</b></td></tr>';
    print '</table></div></div>';
}

print dol_get_fiche_end();

llxFooter();
$db->close();
