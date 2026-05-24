<?php
/**
 * NominasEDU — Gestión de empleados
 *
 * @package NominasEDU
 */

$res = 0;
if (!$res && file_exists("../../main.inc.php"))   { $res = @include "../../main.inc.php"; }
if (!$res && file_exists("../../../main.inc.php")) { $res = @include "../../../main.inc.php"; }
if (!$res) die("Include of main fails");

require_once DOL_DOCUMENT_ROOT.'/core/class/html.form.class.php';
dol_include_once('/nominasedu/lib/nominasedu.lib.php');

$langs->loadLangs(array("nominasedu@nominasedu", "companies", "users"));

$id      = GETPOST('id',      'int');
$action  = GETPOST('action',  'aZ09');
$confirm = GETPOST('confirm', 'alpha');

if (!isModEnabled('nominasedu')) { accessforbidden('Module nominasedu not enabled'); }
if (!$user->hasRight('nominasedu', 'read')) { accessforbidden(); }

$form = new Form($db);

// ── ACCIONES ──────────────────────────────────────────────────────────────────
if ($action == 'add' && $user->hasRight('nominasedu', 'write')) {
    $fkUser   = GETPOST('fk_user', 'int');
    $type     = GETPOST('employee_type', 'aZ09');
    $salary   = (float)str_replace(',', '.', GETPOST('base_salary', 'alpha'));
    $irpf     = (float)str_replace(',', '.', GETPOST('irpf_rate',   'alpha'));
    $ssGroup  = GETPOST('ss_group', 'aZ09');
    $note     = GETPOST('note', 'restricthtml');

    if (!$fkUser || $salary < 0) {
        setEventMessages($langs->trans("EmpleadoRequerido"), null, 'errors');
    } else {
        $sql  = "INSERT INTO ".MAIN_DB_PREFIX."nominasedu_employee";
        $sql .= " (entity, fk_user, employee_type, base_salary, irpf_rate, ss_group, active, note, date_creation)";
        $sql .= " VALUES (".((int)$conf->entity).",".((int)$fkUser).",";
        $sql .= "'".addslashes($type)."',".$salary.",".$irpf.",'".addslashes($ssGroup)."',1,";
        $sql .= "'".addslashes($note)."',NOW())";
        if ($db->query($sql)) {
            setEventMessages($langs->trans("EmpleadoCreado"), null, 'mesgs');
            header('Location: '.DOL_URL_ROOT.'/nominasedu/empleados.php');
            exit;
        } else {
            setEventMessages($db->lasterror(), null, 'errors');
        }
    }
}

if ($action == 'update' && $id > 0 && $user->hasRight('nominasedu', 'write')) {
    $salary  = (float)str_replace(',', '.', GETPOST('base_salary', 'alpha'));
    $irpf    = (float)str_replace(',', '.', GETPOST('irpf_rate',   'alpha'));
    $type    = GETPOST('employee_type', 'aZ09');
    $ssGroup = GETPOST('ss_group', 'aZ09');
    $active  = GETPOST('active', 'int');
    $note    = GETPOST('note', 'restricthtml');

    $sql  = "UPDATE ".MAIN_DB_PREFIX."nominasedu_employee SET";
    $sql .= " employee_type='".addslashes($type)."', base_salary=".$salary.",";
    $sql .= " irpf_rate=".$irpf.", ss_group='".addslashes($ssGroup)."',";
    $sql .= " active=".((int)$active).", note='".addslashes($note)."', tms=NOW()";
    $sql .= " WHERE rowid=".((int)$id)." AND entity=".((int)$conf->entity);
    if ($db->query($sql)) {
        setEventMessages($langs->trans("EmpleadoActualizado"), null, 'mesgs');
        header('Location: '.DOL_URL_ROOT.'/nominasedu/empleados.php');
        exit;
    }
}

if ($action == 'confirm_delete' && $confirm == 'yes' && $id > 0 && $user->hasRight('nominasedu', 'delete')) {
    // Comprobar que no tiene nóminas vinculadas
    $sqlCheck = "SELECT COUNT(*) AS cnt FROM ".MAIN_DB_PREFIX."nominasedu_payroll WHERE fk_employee=".((int)$id);
    $rCheck = $db->query($sqlCheck);
    $oCheck = $db->fetch_object($rCheck);
    if ($oCheck && $oCheck->cnt > 0) {
        setEventMessages("No se puede eliminar: el empleado tiene nóminas registradas.", null, 'errors');
    } else {
        $sql = "DELETE FROM ".MAIN_DB_PREFIX."nominasedu_employee WHERE rowid=".((int)$id)." AND entity=".((int)$conf->entity);
        if ($db->query($sql)) {
            setEventMessages($langs->trans("EmpleadoEliminado"), null, 'mesgs');
            header('Location: '.DOL_URL_ROOT.'/nominasedu/empleados.php');
            exit;
        }
    }
}

// Cargar empleado a editar
$editEmployee = null;
if ($id > 0 && in_array($action, array('edit', 'update', 'delete'))) {
    $editEmployee = nominasedu_get_employee($db, $id, $conf->entity);
}

// ── Consulta lista de empleados ───────────────────────────────────────────────
$sql  = "SELECT e.rowid, e.employee_type, e.base_salary, e.irpf_rate, e.ss_group, e.active,";
$sql .= " u.firstname, u.lastname, u.login, u.email,";
$sql .= " (SELECT COUNT(*) FROM ".MAIN_DB_PREFIX."nominasedu_payroll p WHERE p.fk_employee = e.rowid) AS num_nominas";
$sql .= " FROM ".MAIN_DB_PREFIX."nominasedu_employee AS e";
$sql .= " LEFT JOIN ".MAIN_DB_PREFIX."user AS u ON u.rowid = e.fk_user";
$sql .= " WHERE e.entity=".((int)$conf->entity);
$sql .= " ORDER BY u.lastname, u.firstname";
$resql = $db->query($sql);
$empleados = array();
if ($resql) {
    while ($o = $db->fetch_object($resql)) { $empleados[] = $o; }
    $db->free($resql);
}

// Cargar usuarios Dolibarr para el selector
$usuarios = array();
$sqlU  = "SELECT u.rowid, u.firstname, u.lastname, u.login FROM ".MAIN_DB_PREFIX."user AS u";
$sqlU .= " WHERE u.statut=1 AND u.entity IN (0,".((int)$conf->entity).")";
$sqlU .= " ORDER BY u.lastname, u.firstname";
$rU = $db->query($sqlU);
if ($rU) {
    while ($o = $db->fetch_object($rU)) { $usuarios[] = $o; }
    $db->free($rU);
}

// ── VIEW ──────────────────────────────────────────────────────────────────────
$tipos = array('mensual'=>'Mensual','horas'=>'Por horas','practicas'=>'Prácticas / Beca');
$grupos_ss = array('01'=>'01 - Ingenieros y Licenciados','02'=>'02 - Ingenieros Técnicos','07'=>'07 - Auxiliares Administrativos','09'=>'09 - Oficiales Administrativos','10'=>'10 - Subalternos','11'=>'11 - Auxiliares no titulados');

llxHeader('', $langs->trans("Empleados"), '');

$head = nominasedu_prepare_head();
print dol_get_fiche_head($head, 'empleados', $langs->trans("NominasEDU"), -1, 'salary');

$newLink = $user->hasRight('nominasedu', 'write')
    ? '<a class="butActionNew" href="'.DOL_URL_ROOT.'/nominasedu/empleados.php?action=create">'
      .'<span class="fas fa-plus-circle valignmiddle paddingright"></span>'.$langs->trans("NuevoEmpleado").'</a>'
    : '';
print load_fiche_titre($langs->trans("Empleados"), $newLink, 'user');

// ── Confirmación de borrado ───────────────────────────────────────────────────
if ($action == 'delete' && $id > 0) {
    print $form->formconfirm(
        DOL_URL_ROOT.'/nominasedu/empleados.php?id='.$id,
        $langs->trans("EliminarEmpleado"),
        "¿Seguro que deseas eliminar este empleado? Esta acción no se puede deshacer.",
        'confirm_delete',
        '',
        'yes',
        1
    );
}

// ── Formulario alta / edición ─────────────────────────────────────────────────
if ($action == 'create' || ($action == 'edit' && $editEmployee)) {
    $isEdit = ($action == 'edit' && $editEmployee);
    $formAction = DOL_URL_ROOT.'/nominasedu/empleados.php'.($isEdit ? '?id='.$id : '');

    print '<br>';
    print '<form action="'.$formAction.'" method="post">';
    print '<input type="hidden" name="token" value="'.newToken().'">';
    print '<input type="hidden" name="action" value="'.($isEdit ? 'update' : 'add').'">';

    print '<table class="border centpercent tableforfield">';
    print '<tr class="liste_titre"><th colspan="2">'.($isEdit ? $langs->trans("EditarEmpleado") : $langs->trans("NuevoEmpleado")).'</th></tr>';

    // Usuario (solo en creación)
    if (!$isEdit) {
        print '<tr><td class="titlefield fieldrequired">'.$langs->trans("UsuarioDolibarr").'</td><td>';
        print '<select name="fk_user" class="flat quatrevingtpercent">';
        print '<option value="">'.$langs->trans("SeleccionaEmpleado").'</option>';
        foreach ($usuarios as $u) {
            // Excluir los que ya son empleados
            $yaExiste = false;
            foreach ($empleados as $e) { if ($e->login == $u->login) { $yaExiste = true; break; } }
            if ($yaExiste) continue;
            print '<option value="'.$u->rowid.'">'.htmlspecialchars($u->lastname.' '.$u->firstname.' ('.$u->login.')').'</option>';
        }
        print '</select></td></tr>';
    } else {
        print '<tr><td class="titlefield">'.$langs->trans("UsuarioDolibarr").'</td>';
        print '<td><b>'.dol_escape_htmltag($editEmployee->lastname.' '.$editEmployee->firstname).'</b> ('.$editEmployee->login.')</td></tr>';
    }

    // Tipo de contrato
    print '<tr><td>'.$langs->trans("TipoContrato").'</td><td>';
    print '<select name="employee_type" class="flat">';
    foreach ($tipos as $k => $v) {
        $sel = ($isEdit && $editEmployee->employee_type == $k) ? ' selected' : (!$isEdit && $k == 'mensual' ? ' selected' : '');
        print '<option value="'.$k.'"'.$sel.'>'.$v.'</option>';
    }
    print '</select></td></tr>';

    // Grupo SS
    print '<tr><td>'.$langs->trans("GrupoSS").'</td><td>';
    print '<select name="ss_group" class="flat">';
    foreach ($grupos_ss as $k => $v) {
        $sel = ($isEdit && $editEmployee->ss_group == $k) ? ' selected' : '';
        print '<option value="'.$k.'"'.$sel.'>'.$v.'</option>';
    }
    print '</select></td></tr>';

    // Salario base
    print '<tr><td class="fieldrequired">'.$langs->trans("SalarioBase").' (€)</td>';
    print '<td><input type="number" name="base_salary" class="flat maxwidth100" step="0.01" min="0" value="'.($isEdit ? htmlspecialchars($editEmployee->base_salary) : '1645.00').'"></td></tr>';

    // % IRPF
    print '<tr><td class="fieldrequired">'.$langs->trans("PorcentajeIRPF").'</td>';
    print '<td><input type="number" name="irpf_rate" class="flat maxwidth75" step="0.01" min="0" max="50" value="'.($isEdit ? htmlspecialchars($editEmployee->irpf_rate) : '15').'"> %</td></tr>';

    // Activo (solo en edición)
    if ($isEdit) {
        print '<tr><td>'.$langs->trans("EmpleadoActivo").'</td><td>';
        print '<select name="active" class="flat">';
        print '<option value="1"'.($editEmployee->active ? ' selected' : '').'>'.$langs->trans("Actif").'</option>';
        print '<option value="0"'.(!$editEmployee->active ? ' selected' : '').'>'.$langs->trans("Inactif").'</option>';
        print '</select></td></tr>';
    }

    print '</table>';
    print '<div class="tabsAction">';
    print '<input type="submit" class="butAction" value="'.$langs->trans("Guardar").'">';
    print '<a class="butActionDelete" href="'.DOL_URL_ROOT.'/nominasedu/empleados.php">'.$langs->trans("Annuler").'</a>';
    print '</div></form><br>';
}

// ── Lista de empleados ────────────────────────────────────────────────────────
print '<div class="div-table-responsive">';
print '<table class="tagtable nobottomiftotal liste centpercent">';
print '<thead><tr class="liste_titre">';
print '<th>'.$langs->trans("NombreEmpleado").'</th>';
print '<th>'.$langs->trans("UsuarioDolibarr").'</th>';
print '<th>'.$langs->trans("TipoContrato").'</th>';
print '<th>'.$langs->trans("GrupoSS").'</th>';
print '<th class="right">'.$langs->trans("SalarioBase").'</th>';
print '<th class="right">'.$langs->trans("PorcentajeIRPF").'</th>';
print '<th class="center">'.$langs->trans("Nóminas").'</th>';
print '<th class="center">Estado</th>';
print '<th></th>';
print '</tr></thead><tbody>';

if (empty($empleados)) {
    print '<tr class="oddeven"><td colspan="9" class="center opacitymedium">';
    print $langs->trans("SinEmpleados");
    print '</td></tr>';
} else {
    foreach ($empleados as $e) {
        print '<tr class="oddeven">';
        print '<td><a href="'.DOL_URL_ROOT.'/nominasedu/empleados.php?action=edit&id='.$e->rowid.'">'.dol_escape_htmltag($e->lastname.' '.$e->firstname).'</a></td>';
        print '<td><span class="opacitymedium">'.dol_escape_htmltag($e->login).'</span></td>';
        print '<td>'.($tipos[$e->employee_type] ?? $e->employee_type).'</td>';
        print '<td><span class="opacitymedium">Gr. '.$e->ss_group.'</span></td>';
        print '<td class="right"><b>'.price($e->base_salary).' €</b></td>';
        print '<td class="right">'.$e->irpf_rate.'%</td>';
        print '<td class="center"><span class="badge">'.((int)$e->num_nominas).'</span></td>';
        print '<td class="center">'.($e->active
            ? '<span class="badge badge-status4 badge-status">'.$langs->trans("Actif").'</span>'
            : '<span class="badge badge-status8 badge-status">'.$langs->trans("Inactif").'</span>').'</td>';
        print '<td class="right nowrap">';
        if ($user->hasRight('nominasedu', 'write')) {
            print '<a class="editfielda marginleftonlyshort" href="'.DOL_URL_ROOT.'/nominasedu/empleados.php?action=edit&id='.$e->rowid.'">';
            print '<span class="fas fa-edit" title="'.$langs->trans("Modifier").'"></span></a>';
        }
        if ($user->hasRight('nominasedu', 'delete')) {
            print ' <a class="editfielda marginleftonlyshort" href="'.DOL_URL_ROOT.'/nominasedu/empleados.php?action=delete&id='.$e->rowid.'&token='.newToken().'">';
            print '<span class="fas fa-trash" title="'.$langs->trans("Supprimer").'"></span></a>';
        }
        print '</td></tr>';
    }
}

print '</tbody></table></div>';

print dol_get_fiche_end();

llxFooter();
$db->close();
