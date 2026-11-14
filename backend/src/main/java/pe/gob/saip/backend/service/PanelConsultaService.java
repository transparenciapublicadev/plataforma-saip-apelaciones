package pe.gob.saip.backend.service;

import static pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA;

import java.text.Normalizer;
import java.time.*;
import java.util.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.PanelConsultaRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

/** Resolves the current account before querying rows or aggregates. */
@Service
public class PanelConsultaService {
    private final AutorizacionRecursosService autorizacion;
    private final FuncionarioRepository funcionarios;
    private final PanelConsultaRepository repository;
    private final PlazoCalculadorService calendario;
    public PanelConsultaService(AutorizacionRecursosService autorizacion, FuncionarioRepository funcionarios,
                                 PanelConsultaRepository repository, PlazoCalculadorService calendario) {
        this.autorizacion=autorizacion; this.funcionarios=funcionarios; this.repository=repository; this.calendario=calendario;
    }
    // Rows and aggregates share a database snapshot even with concurrent insertions.
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public PanelPaginaDTO<PanelSolicitudDTO> solicitudes(int pagina,int tamano,String busqueda,String estado,String etapa,
                                                        String orden,Long entidadId) {
        var alcance=alcance();
        var filtro=filtro(false,alcance,pagina,tamano,busqueda,estado,etapa,orden,entidadId,null);
        LocalDate today=calendario.hoy();
        var datos=repository.consultar(false,alcance,filtro,today,threshold(today,-1),threshold(today,1),threshold(today,5));
        var rows=datos.filas().stream().map(row->solicitud(row,datos.observaciones().getOrDefault(id(row,"id_solicitud"),List.of()),today)).toList();
        return pagina(rows,datos,filtro,alcance,"FECHA_LIMITE_REGISTRADA_SAIP");
    }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public PanelPaginaDTO<PanelApelacionDTO> apelaciones(int pagina,int tamano,String busqueda,String estado,String etapa,
                                                       String orden,Long entidadId,String sala) {
        var alcance=alcance();
        var filtro=filtro(true,alcance,pagina,tamano,busqueda,estado,etapa,orden,entidadId,sala);
        LocalDate today=LocalDate.now();
        var datos=repository.consultar(true,alcance,filtro,today,threshold(today,-1),threshold(today,1),threshold(today,5));
        return pagina(datos.filas().stream().map(this::apelacion).toList(),datos,filtro,alcance,"INICIO_ACREDITADO_SUBSANACION_TTAIP;OTRAS_ETAPAS_NO_INFORMADAS");
    }
    private <T> PanelPaginaDTO<T> pagina(List<T> rows,PanelConsultaRepository.Datos datos,PanelConsultaRepository.Filtro filtro,
                                        PanelConsultaRepository.Alcance alcance,String fuente) {
        int pages=(int)((datos.total()+filtro.tamano()-1)/filtro.tamano());
        return new PanelPaginaDTO<>(rows,filtro.pagina(),filtro.tamano(),datos.total(),pages,
            filtro.pagina()+1>=pages,datos.resumen(),datos.entidades(),datos.salas(),datos.opcionesLimitadas(),alcance.nombre(),fuente);
    }
    private PanelConsultaRepository.Alcance alcance() {
        Usuario user=autorizacion.obtenerUsuarioActual();
        if (!Boolean.TRUE.equals(user.getActivo())) throw new AccessDeniedException("Se requiere una cuenta activa");
        if (autorizacion.esAdministradorOTtaip()) return new PanelConsultaRepository.Alcance(null,null,"GLOBAL_AUTORIZADO");
        if (autorizacion.esFuncionario()) {
            Funcionario staff=funcionarios.findById(user.getIdUsuario()).orElseThrow(()->new AccessDeniedException("No existe contexto institucional"));
            if(staff.getEntidad()==null)throw new AccessDeniedException("No existe contexto institucional");
            return new PanelConsultaRepository.Alcance(null,staff.getEntidad().getId(),"ENTIDAD");
        }
        autorizacion.verificarCiudadanoActualOAdministrador(user.getIdUsuario());
        return new PanelConsultaRepository.Alcance(user.getIdUsuario(),null,"CIUDADANO");
    }
    private PanelConsultaRepository.Filtro filtro(boolean apelaciones,PanelConsultaRepository.Alcance alcance,int pagina,int tamano,
                                                  String busqueda,String estado,String etapa,String orden,Long entidadId,String sala) {
        if(pagina<0||pagina>10000)throw new IllegalArgumentException("La página debe estar entre 0 y 10000");
        if(tamano<1||tamano>100)throw new IllegalArgumentException("El tamaño debe estar entre 1 y 100");
        if(busqueda!=null&&busqueda.length()>120)throw new IllegalArgumentException("La búsqueda admite hasta 120 caracteres");
        busqueda=blank(busqueda);
        if(busqueda!=null)busqueda=Normalizer.normalize(busqueda,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);
        estado=blank(estado);
        if(estado!=null) {
            try { if(apelaciones) Apelacion.EstadoApelacion.valueOf(estado); else Solicitud.EstadoSolicitud.valueOf(estado); }
            catch(IllegalArgumentException ex){throw new IllegalArgumentException("Estado de listado no válido");}
        }
        etapa=blank(etapa); if("todas".equals(etapa)||"todos".equals(etapa))etapa=null;
        Set<String> stages=apelaciones?Set.of("elevacion","calificacion1","subsanacion","calificacion2","resolucion","resueltos","otras")
            :alcance.ciudadanoId()!=null?Set.of("accion","proceso","respondidas","apelar","tribunal","resueltas","otras")
            :Set.of("san","hoy","semana","plazo","precision","respondidas","desconocido");
        if(etapa!=null&&!stages.contains(etapa))throw new IllegalArgumentException("Etapa no válida para este panel");
        orden=blank(orden);if(orden==null)orden="recientes";
        if(!Set.of("recientes","antiguas").contains(orden))throw new IllegalArgumentException("Orden no válido");
        if(entidadId!=null&&entidadId<1)throw new IllegalArgumentException("Entidad no válida");
        if(entidadId!=null&&alcance.entidadId()!=null&&!entidadId.equals(alcance.entidadId()))throw new AccessDeniedException("La entidad no corresponde al actor");
        sala=blank(sala);
        if(sala!=null&&!sala.equals("SIN_SALA"))try {if(Long.parseLong(sala)<1)throw new NumberFormatException();}catch(NumberFormatException ex){throw new IllegalArgumentException("Sala no válida");}
        return new PanelConsultaRepository.Filtro(pagina,tamano,busqueda,estado,etapa,orden,entidadId,sala);
    }
    private static String blank(String value){return value==null||value.isBlank()?null:value.trim();}
    /** SQL bands use the existing SAIP clock; no calendar or efficacy policy is changed. */
    static LocalDate threshold(LocalDate today,int days) {
        LocalDate date=today.minusDays(20);
        while(remaining(today,date.plusDays(1))<=days)date=date.plusDays(1);
        return date;
    }
    private static int remaining(LocalDate today,LocalDate end){return today.isAfter(end)?-DiasHabilesUtil.contarDiasHabiles(end,today):DiasHabilesUtil.contarDiasHabiles(today,end);}
    private PanelSolicitudDTO solicitud(Map<String,Object> r,List<Map<String,Object>> observations, LocalDate hoy) {
        LocalDate limit=date(r,"fecha_limite");
        LocalDate inicio = observations.stream().filter(o -> "SUBSANADA".equals(str(o,"estado")))
            .map(o -> day(o,"fecha_subsanacion")).filter(Objects::nonNull).max(Comparator.naturalOrder())
            .orElseGet(() -> day(r,"fecha_presentacion"));
        return new PanelSolicitudDTO(id(r,"id_solicitud"),str(r,"expediente"),str(r,"asunto"),str(r,"descripcion"),str(r,"estado"),
            str(r,"prioridad"),str(r,"tipo_informacion"),text(r,"fecha_presentacion"),text(r,"fecha_limite"),limit==null?null:DiasHabilesUtil.diasHabilesVigentes(inicio, limit, hoy),
            id(r,"id_ciudadano"),str(r,"ciudadano_nombre"),id(r,"id_entidad"),str(r,"entidad_nombre"),str(r,"entidad_acronimo"),str(r,"etapa"),
            id(r,"id_respuesta")==null?null:new PanelSolicitudDTO.PanelRespuestaDTO(id(r,"id_respuesta"),str(r,"tipo_respuesta"),text(r,"fecha_respuesta")),
            observations.stream().map(o->new PanelSolicitudDTO.PanelObservacionDTO(id(o,"id_observacion"),id(o,"id_solicitud"),str(o,"estado"),
                text(o,"fecha_observacion"),text(o,"fecha_limite_subsanacion"),text(o,"fecha_subsanacion"),
                date(o,"fecha_limite_subsanacion")==null?null:DiasHabilesUtil.diasHabilesVigentes(day(o,"fecha_observacion"), date(o,"fecha_limite_subsanacion"), hoy))).toList(),
            id(r,"a_id")==null?null:apelacion(r),
            oficina(r), str(r,"area_responsable"), str(r,"encargado_area"));
    }
    private static String oficina(Map<String,Object> r) {
        String guardada = str(r, "oficina_destinataria");
        return guardada != null ? guardada : Solicitud.oficinaIndicada(str(r, "descripcion"));
    }
    private PanelApelacionDTO apelacion(Map<String,Object> r) {
        return new PanelApelacionDTO(id(r,"a_id"),str(r,"a_expediente"),str(r,"a_fundamentos"),str(r,"a_estado"),str(r,"a_resultado"),text(r,"a_fecha"),
            id(r,"a_solicitud_id"),str(r,"a_solicitud_expediente"),str(r,"a_solicitud_asunto"),id(r,"a_ciudadano_id"),str(r,"a_ciudadano_nombre"),
            id(r,"a_entidad_id"),str(r,"a_entidad_nombre"),str(r,"entidad_externa_nombre"),str(r,"resumen_solicitud_original"),str(r,"tipo_origen"),
            str(r,"numero_solicitud_externa"),str(r,"calificacion_primera"),str(r,"calificacion_segunda"),"resueltos".equals(str(r,"a_etapa")),str(r,"a_etapa"),
            id(r,"id_expediente_ttaip")==null?null:new PanelApelacionDTO.PanelExpedienteDTO(id(r,"id_expediente_ttaip"),id(r,"id_sala_ttaip")==null?null:new PanelOpcionDTO(id(r,"id_sala_ttaip"),str(r,"sala_nombre"))),
            resolution(r,"rf","RESOLUCION_FINAL"),resolution(r,"r1","PRIMERA_CALIFICACION"),resolution(r,"r2","SEGUNDA_CALIFICACION"),clock(r));
    }
    private PanelApelacionDTO.PanelResolucionDTO resolution(Map<String,Object> r,String prefix,String type) {
        return id(r,prefix+"_id")==null?null:new PanelApelacionDTO.PanelResolucionDTO(id(r,prefix+"_id"),type,str(r,prefix+"_decision"),text(r,prefix+"_fecha"));
    }
    private PlazoSubsanacionTtaipDTO clock(Map<String,Object> r) {
        if(id(r,"r1_id")==null||!"INADMISIBLE".equals(str(r,"r1_decision")))return null;
        // Same source as PlazoSubsanacionTtaipDTO.from; never substitute creation/opening/send time.
        if(r.get("ip_eficacia")==null)return new PlazoSubsanacionTtaipDTO(id(r,"r1_id"),"PENDIENTE_INICIO",null,null,null,
            r.get("dias_subsanacion")==null?2:((Number)r.get("dias_subsanacion")).intValue(),null,null);
        LocalDateTime effective=((java.sql.Timestamp)r.get("ip_eficacia")).toLocalDateTime();
        int days=((Number)r.get("ip_dias")).intValue();
        LocalDate limit=DiasHabilesUtil.sumarDiasHabiles(effective.toLocalDate(),days);
        return new PlazoSubsanacionTtaipDTO(id(r,"r1_id"),LocalDate.now().isAfter(limit)?"VENCIDO":"EN_CURSO",id(r,"ip_notificacion"),effective,limit,
            days,DiasHabilesUtil.diasHabilesVigentes(effective.toLocalDate(), limit),str(r,"ip_fuente"));
    }
    private static Long id(Map<String,Object> r,String key){return r.get(key)==null?null:((Number)r.get(key)).longValue();}
    private static String str(Map<String,Object> r,String key){return (String)r.get(key);}
    private static LocalDate date(Map<String,Object> r,String key){return r.get(key)==null?null:((java.sql.Date)r.get(key)).toLocalDate();}
    private static LocalDate day(Map<String,Object> r,String key){
        Object value=r.get(key);
        if(value instanceof java.sql.Timestamp timestamp)return timestamp.toInstant().atZone(ZONA_LIMA).toLocalDate();
        if(value instanceof java.sql.Date sqlDate)return sqlDate.toLocalDate();
        if(value instanceof java.time.OffsetDateTime offset)return offset.atZoneSameInstant(ZONA_LIMA).toLocalDate();
        if(value instanceof java.time.LocalDateTime dateTime)return dateTime.toLocalDate();
        if(value instanceof java.time.LocalDate date)return date;
        if(value instanceof CharSequence text && text.length()>=10){
            try{return java.time.LocalDate.parse(text.subSequence(0,10));}catch(java.time.format.DateTimeParseException ignored){return null;}
        }
        return null;
    }
    private static String text(Map<String,Object> r,String key){Object v=r.get(key);return v==null?null:v instanceof java.sql.Timestamp t?t.toLocalDateTime().toString():v instanceof java.sql.Date d?d.toLocalDate().toString():v.toString();}
}
