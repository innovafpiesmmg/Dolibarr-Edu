<?php
/**
 * Descripción y parámetros del módulo NominasEDU para Dolibarr.
 *
 * @package NominasEDU
 */

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

class modNominasEdu extends DolibarrModules
{
    public function __construct($db)
    {
        global $langs, $conf;

        $this->db = $db;

        // Identificador único del módulo (>= 500000 para módulos de terceros)
        $this->numero = 500041;
        $this->rights_class = 'nominasedu';
        $this->family = 'hr';
        $this->module_position = '55';
        $this->familyinfo = array('hr' => array('position' => '55', 'label' => $langs->trans("HumanResources")));

        $this->name = preg_replace('/^mod/i', '', get_class($this));
        $this->description = "Módulo de nóminas educativo integrado para ERP EDU";
        $this->descriptionlong = "Permite gestionar nóminas, empleados y liquidaciones de SS/IRPF directamente dentro del ERP Dolibarr, diseñado para la FP de Administración de Empresas.";

        $this->editor_name = 'Atreyu Servicios Digitales (ASD)';
        $this->editor_url = 'https://github.com/innovafpiesmmg/Dolibarr-Edu';

        $this->version = '1.0';
        $this->const_name = 'MAIN_MODULE_'.strtoupper($this->name);
        $this->picto = 'salary';

        // Dependencias
        $this->depends = array('modSociete', 'modBanque');
        $this->requiredby = array();
        $this->conflictwith = array();
        $this->langfiles = array("nominasedu@nominasedu");

        // Constantes del módulo
        $this->const = array();

        // Tablas que gestiona este módulo
        $this->module_parts = array(
            'triggers' => 0,
            'login'    => 0,
            'substitutions' => 0,
            'menus'    => 0,
            'tpl'      => 0,
            'hooks'    => array(),
            'moduleforexternal' => 0,
        );

        // Tablas SQL
        $this->tables = array(
            'nominasedu_employee',
            'nominasedu_payroll',
            'nominasedu_ss_payment',
        );
        $this->_load_tables('/nominasedu/sql/');

        // Permisos
        $r = 0;
        $this->rights[$r][0] = $this->numero + 1;
        $this->rights[$r][1] = 'Consultar nóminas y empleados';
        $this->rights[$r][3] = 1;
        $this->rights[$r][4] = 'read';
        $r++;

        $this->rights[$r][0] = $this->numero + 2;
        $this->rights[$r][1] = 'Crear y editar nóminas y empleados';
        $this->rights[$r][3] = 0;
        $this->rights[$r][4] = 'write';
        $r++;

        $this->rights[$r][0] = $this->numero + 3;
        $this->rights[$r][1] = 'Eliminar nóminas y empleados';
        $this->rights[$r][3] = 0;
        $this->rights[$r][4] = 'delete';
        $r++;

        // Menú superior
        $r = 0;
        $this->menu[$r++] = array(
            'fk_menu'  => 0,
            'type'     => 'top',
            'titre'    => 'NominasEDU',
            'mainmenu' => 'nominasedu',
            'url'      => '/nominasedu/index.php',
            'langs'    => 'nominasedu@nominasedu',
            'position' => 100,
            'enabled'  => 'isModEnabled("nominasedu")',
            'perms'    => '$user->hasRight("nominasedu","read")',
            'target'   => '',
            'user'     => 0,
        );

        // Menú lateral izquierdo
        $this->menu[$r++] = array(
            'fk_menu'  => 'fk_mainmenu=nominasedu',
            'type'     => 'left',
            'titre'    => 'ListaNominas',
            'mainmenu' => 'nominasedu',
            'leftmenu' => 'nominasedu_list',
            'url'      => '/nominasedu/index.php',
            'langs'    => 'nominasedu@nominasedu',
            'position' => 100,
            'enabled'  => 'isModEnabled("nominasedu")',
            'perms'    => '$user->hasRight("nominasedu","read")',
            'target'   => '',
            'user'     => 0,
        );

        $this->menu[$r++] = array(
            'fk_menu'  => 'fk_mainmenu=nominasedu',
            'type'     => 'left',
            'titre'    => 'NuevaNomina',
            'mainmenu' => 'nominasedu',
            'leftmenu' => 'nominasedu_new',
            'url'      => '/nominasedu/nomina_card.php?action=create',
            'langs'    => 'nominasedu@nominasedu',
            'position' => 110,
            'enabled'  => 'isModEnabled("nominasedu")',
            'perms'    => '$user->hasRight("nominasedu","write")',
            'target'   => '',
            'user'     => 0,
        );

        $this->menu[$r++] = array(
            'fk_menu'  => 'fk_mainmenu=nominasedu',
            'type'     => 'left',
            'titre'    => 'Empleados',
            'mainmenu' => 'nominasedu',
            'leftmenu' => 'nominasedu_empleados',
            'url'      => '/nominasedu/empleados.php',
            'langs'    => 'nominasedu@nominasedu',
            'position' => 120,
            'enabled'  => 'isModEnabled("nominasedu")',
            'perms'    => '$user->hasRight("nominasedu","read")',
            'target'   => '',
            'user'     => 0,
        );

        $this->menu[$r++] = array(
            'fk_menu'  => 'fk_mainmenu=nominasedu',
            'type'     => 'left',
            'titre'    => 'LiquidacionSS',
            'mainmenu' => 'nominasedu',
            'leftmenu' => 'nominasedu_ss',
            'url'      => '/nominasedu/ss.php',
            'langs'    => 'nominasedu@nominasedu',
            'position' => 130,
            'enabled'  => 'isModEnabled("nominasedu")',
            'perms'    => '$user->hasRight("nominasedu","read")',
            'target'   => '',
            'user'     => 0,
        );
    }

    public function init($options = '')
    {
        $sql = array();
        return $this->_init($sql, $options);
    }

    public function remove($options = '')
    {
        $sql = array();
        return $this->_remove($sql, $options);
    }
}
