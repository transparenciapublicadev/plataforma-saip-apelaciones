package pe.gob.saip.backend.repository;

import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.dto.*;

/** SQL projections keep ownership, filters, counts and pagination in PostgreSQL, not in memory.
 * No entity/collection hydration or documents are needed by the panel. */
@Repository
public class PanelConsultaRepository {
    public record Alcance(Long ciudadanoId, Long entidadId, String nombre) {}
    public record Filtro(int pagina, int tamano, String busqueda, String estado, String etapa,
                         String orden, Long entidadId, String sala) {}
    public record Datos(List<Map<String,Object>> filas, long total, PanelResumenDTO resumen,
                        List<PanelOpcionDTO> entidades, List<PanelOpcionDTO> salas, boolean opcionesLimitadas,
                        Map<Long,List<Map<String,Object>>> observaciones) {}
    private final NamedParameterJdbcTemplate jdbc;
    public PanelConsultaRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String FINAL = "('RESUELTO','RESUELTO_FUNDADO','RESUELTO_FUNDADO_EN_PARTE','RESUELTO_INFUNDADO','RESUELTO_INFUNDADO_EN_PARTE','RESUELTO_IMPROCEDENTE','RESUELTO_ESTESE_A_LO_RESUELTO','RESUELTO_NULIDAD_ACTO','TENER_POR_NO_PRESENTADO','CONCLUSION_SUSTRACCION_MATERIA','CONCLUSION_DESISTIMIENTO')";
    private static final String AP_STAGE = "case when a.estado='PENDIENTE_ELEVACION' then 'elevacion' when a.estado='EN_CALIFICACION_1' then 'calificacion1' when a.estado='EN_SUBSANACION' then 'subsanacion' when a.estado in ('EN_CALIFICACION_2','NOTIFICACION_SEGUNDA_CALIFICACION') then 'calificacion2' when a.estado='EN_RESOLUCION' then 'resolucion' when a.estado in " + FINAL + " then 'resueltos' else 'otras' end";
    private static final String PENDING_OBSERVATION = "exists (select 1 from observaciones_solicitud o where o.id_solicitud=s.id_solicitud and o.estado='PENDIENTE_SUBSANACION')";
    private static final String CITIZEN_STAGE = "case when a.estado='EN_SUBSANACION' or (s.estado='PENDIENTE_INFORMACION' and " + PENDING_OBSERVATION + ") then 'accion' when a.estado in " + FINAL + " then 'resueltas' when a.id_apelacion is not null then 'tribunal' when s.estado in ('DENEGADA','VENCIDA') or (s.estado in ('RECEPCIONADA','EN_REVISION','PENDIENTE_INFORMACION') and s.fecha_limite<=:vencida) then 'apelar' when s.estado='RESPONDIDA' then 'respondidas' when s.estado in ('RECEPCIONADA','EN_REVISION','PENDIENTE_INFORMACION') then 'proceso' else 'otras' end";
    private static final String ENTITY_STAGE = "case when s.estado in ('RESPONDIDA','DENEGADA') or rp.id_respuesta is not null then 'respondidas' when s.estado='VENCIDA' or s.fecha_limite<=:vencida then 'san' when s.fecha_limite<=:hastaUno then 'hoy' when s.fecha_limite<=:hastaCinco then 'semana' when s.fecha_limite is not null then 'plazo' else 'desconocido' end";

    private static final String AP_COLUMNS = """
        a.id_apelacion a_id, a.expediente a_expediente, a.estado a_estado, a.fundamentos a_fundamentos,
        a.resultado a_resultado, a.fecha_apelacion a_fecha, a.id_solicitud a_solicitud_id,
        s.expediente a_solicitud_expediente, s.asunto a_solicitud_asunto,
        a.id_ciudadano a_ciudadano_id, ac.nombre_completo a_ciudadano_nombre,
        coalesce(s.id_entidad,a.id_entidad_apelada) a_entidad_id,
        coalesce(ae.nombre,a.entidad_externa_nombre) a_entidad_nombre,
        a.entidad_externa_nombre, a.resumen_solicitud_original, a.tipo_origen,
        a.numero_solicitud_externa, a.calificacion_primera, a.calificacion_segunda, a.dias_subsanacion,
        ex.id_expediente_ttaip, ex.id_sala_ttaip, sala.nombre sala_nombre,
        r1.id_resolucion r1_id, r1.decision r1_decision, r1.fecha_resolucion r1_fecha,
        r2.id_resolucion r2_id, r2.decision r2_decision, r2.fecha_resolucion r2_fecha,
        rf.id_resolucion rf_id, rf.decision rf_decision, rf.fecha_resolucion rf_fecha,
        ip.id_notificacion ip_notificacion, ip.fecha_eficacia ip_eficacia, ip.dias_habiles ip_dias, ip.fuente ip_fuente
        """;
    private static final String AP_JOINS = """
        left join ciudadanos ac on ac.id_usuario=a.id_ciudadano
        left join entidades ae on ae.id_entidad=coalesce(s.id_entidad,a.id_entidad_apelada)
        left join expedientes_ttaip ex on ex.id_apelacion=a.id_apelacion
        left join salas_ttaip sala on sala.id_sala_ttaip=ex.id_sala_ttaip
        left join lateral (select id_resolucion,decision,fecha_resolucion from resoluciones
            where id_apelacion=a.id_apelacion and tipo_resolucion='PRIMERA_CALIFICACION'
            order by fecha_resolucion desc nulls last,id_resolucion desc limit 1) r1 on true
        left join lateral (select id_resolucion,decision,fecha_resolucion from resoluciones
            where id_apelacion=a.id_apelacion and tipo_resolucion='SEGUNDA_CALIFICACION'
            order by fecha_resolucion desc nulls last,id_resolucion desc limit 1) r2 on true
        left join lateral (select id_resolucion,decision,fecha_resolucion from resoluciones
            where id_apelacion=a.id_apelacion and tipo_resolucion='RESOLUCION_FINAL'
            order by fecha_resolucion desc nulls last,id_resolucion desc limit 1) rf on true
        left join inicios_plazo_subsanacion_ttaip ip on ip.id_requerimiento=r1.id_resolucion and ip.id_ciudadano=a.id_ciudadano
        """;
    private static final String SAIP_FROM = """
        from solicitudes s join ciudadanos c on c.id_usuario=s.id_ciudadano
        join entidades e on e.id_entidad=s.id_entidad
        left join respuestas rp on rp.id_solicitud=s.id_solicitud
        left join apelaciones a on a.id_solicitud=s.id_solicitud and a.id_ciudadano=s.id_ciudadano
        """;
    private static final String AP_FROM = "from apelaciones a left join solicitudes s on s.id_solicitud=a.id_solicitud ";

    public Datos consultar(boolean apelaciones, Alcance alcance, Filtro filtro,
                           LocalDate vencida, LocalDate hastaUno, LocalDate hastaCinco) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("vencida",vencida).addValue("hastaUno",hastaUno).addValue("hastaCinco",hastaCinco)
            .addValue("actor",alcance.ciudadanoId()).addValue("entidadActor",alcance.entidadId());
        String stage = apelaciones ? AP_STAGE : alcance.ciudadanoId()!=null ? CITIZEN_STAGE : ENTITY_STAGE;
        String from = (apelaciones ? AP_FROM : SAIP_FROM) + AP_JOINS;
        String alias = apelaciones ? "a" : "s";
        String effectiveEntity = apelaciones ? "coalesce(s.id_entidad,a.id_entidad_apelada)" : "s.id_entidad";
        String scope = " where 1=1";
        if (alcance.ciudadanoId()!=null) scope += " and " + alias + ".id_ciudadano=:actor";
        if (alcance.entidadId()!=null) scope += " and " + effectiveEntity + "=:entidadActor";
        String where = scope;
        if (filtro.entidadId()!=null) { where += " and " + effectiveEntity + "=:entidadFiltro"; params.addValue("entidadFiltro",filtro.entidadId()); }
        if (filtro.estado()!=null) { where += " and " + alias + ".estado=:estado"; params.addValue("estado",filtro.estado()); }
        if (filtro.etapa()!=null) { where += " and ("+stage+")=:etapa"; params.addValue("etapa",filtro.etapa()); }
        if (filtro.sala()!=null) {
            where += filtro.sala().equals("SIN_SALA") ? " and ex.id_sala_ttaip is null" : " and ex.id_sala_ttaip=:sala";
            if (!filtro.sala().equals("SIN_SALA")) params.addValue("sala",Long.valueOf(filtro.sala()));
        }
        if (filtro.busqueda()!=null) {
            String fields = apelaciones
                ? "concat_ws(' ',a.expediente,a.fundamentos,s.asunto,a.resumen_solicitud_original,ac.nombre_completo,ae.nombre,a.entidad_externa_nombre)"
                : "concat_ws(' ',s.expediente,s.asunto,s.descripcion,c.nombre_completo,e.nombre,e.acronimo)";
            where += " and lower(translate("+fields+",'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')) like :busqueda escape '!'";
            params.addValue("busqueda","%"+filtro.busqueda().replace("!","!!").replace("%","!%").replace("_","!_")+"%");
        }
        long total = jdbc.queryForObject("select count(*) "+from+where,params,Long.class);
        String columns = apelaciones ? AP_COLUMNS : """
            s.id_solicitud,s.expediente,s.asunto,s.descripcion,s.estado,s.prioridad,s.tipo_informacion,
            s.fecha_presentacion,s.fecha_limite,s.id_ciudadano,c.nombre_completo ciudadano_nombre,
            s.id_entidad,e.nombre entidad_nombre,e.acronimo entidad_acronimo,
            rp.id_respuesta,rp.tipo_respuesta,rp.fecha_respuesta,
            """+AP_COLUMNS;
        String date = apelaciones ? "a.fecha_apelacion" : "s.fecha_presentacion";
        String id = apelaciones ? "a.id_apelacion" : "s.id_solicitud";
        String direction = filtro.orden().equals("antiguas") ? " asc" : " desc";
        params.addValue("limit",filtro.tamano()).addValue("offset",(long)filtro.pagina()*filtro.tamano());
        List<Map<String,Object>> rows = jdbc.queryForList("select "+columns+",("+stage+") etapa,"+AP_STAGE+" a_etapa "+from+where
            +" order by "+date+direction+" nulls last,"+id+direction+" limit :limit offset :offset",params);
        Map<String,Long> states = group(alias+".estado",from+scope,params);
        Map<String,Long> stages = group(stage,from+scope,params);
        Map<String,Long> result = apelaciones ? group("rf.decision",from+scope+" and a.estado in "+FINAL+" and rf.decision is not null",params) : Map.of();
        Map<String,Long> topics = apelaciones ? Map.of() : group("s.tipo_informacion",from+scope+" and s.tipo_informacion is not null",params);
        List<PanelOpcionDTO> entities = jdbc.query("select distinct "+effectiveEntity+" id, "+(apelaciones?"coalesce(ae.nombre,a.entidad_externa_nombre)":"e.nombre")+" nombre "+from+scope
            +" and "+effectiveEntity+" is not null order by nombre,id limit 501",params,(rs,n)->new PanelOpcionDTO(rs.getLong("id"),rs.getString("nombre")));
        List<PanelOpcionDTO> salas = apelaciones ? jdbc.query("select distinct sala.id_sala_ttaip id,sala.nombre "+from+scope
            +" and sala.id_sala_ttaip is not null order by nombre,id limit 501",params,(rs,n)->new PanelOpcionDTO(rs.getLong("id"),rs.getString("nombre"))) : List.of();
        boolean limited = entities.size()>500 || salas.size()>500;
        Map<Long,List<Map<String,Object>>> observations = new LinkedHashMap<>();
        if (!apelaciones && !rows.isEmpty()) {
            List<Long> ids = rows.stream().map(r->((Number)r.get("id_solicitud")).longValue()).toList();
            jdbc.queryForList("select id_observacion,id_solicitud,estado,fecha_observacion,fecha_limite_subsanacion,fecha_subsanacion from observaciones_solicitud where id_solicitud in (:ids) order by fecha_observacion desc,id_observacion desc",new MapSqlParameterSource("ids",ids))
                .forEach(r->observations.computeIfAbsent(((Number)r.get("id_solicitud")).longValue(),k->new ArrayList<>()).add(r));
        }
        return new Datos(rows,total,new PanelResumenDTO(states.values().stream().mapToLong(Long::longValue).sum(),states,stages,result,topics,group("cast("+effectiveEntity+" as varchar)",from+scope+" and "+effectiveEntity+" is not null",params)),
            entities.stream().limit(500).toList(),salas.stream().limit(500).toList(),limited,observations);
    }
    private Map<String,Long> group(String expression,String fromWhere,MapSqlParameterSource params) {
        Map<String,Long> result = new LinkedHashMap<>();
        jdbc.query("select "+expression+" k,count(*) n "+fromWhere+" group by "+expression,params,rs->{
            String key=rs.getString("k"); if(key!=null)result.put(key,rs.getLong("n"));
        });
        return Map.copyOf(result);
    }
}
