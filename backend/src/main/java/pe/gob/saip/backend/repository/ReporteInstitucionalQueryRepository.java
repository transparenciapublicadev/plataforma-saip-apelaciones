package pe.gob.saip.backend.repository;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.*;
import pe.gob.saip.backend.util.PlazoAtencionReporte;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** Explicit scalar projections: no entity graph, no in-memory authorization or pagination. */
@Repository
public class ReporteInstitucionalQueryRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public ReporteInstitucionalQueryRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    private String source(boolean entidad) {
        return entidad ? " FROM solicitudes x JOIN entidades e ON e.id_entidad=x.id_entidad LEFT JOIN respuestas r ON r.id_solicitud=x.id_solicitud "
            : " FROM apelaciones x LEFT JOIN solicitudes s ON s.id_solicitud=x.id_solicitud LEFT JOIN entidades e ON e.id_entidad=COALESCE(x.id_entidad_apelada,s.id_entidad) ";
    }
    private String date(boolean entidad) { return entidad ? "x.fecha_presentacion" : "x.fecha_apelacion"; }
    private String evidence(boolean entidad) { return entidad ? "r.id_respuesta IS NOT NULL"
        : "EXISTS (SELECT 1 FROM resoluciones r WHERE r.id_apelacion=x.id_apelacion AND r.tipo_resolucion='RESOLUCION_FINAL')"; }
    private String scope(boolean entidad) { return " WHERE " + date(entidad) + ">=:desde AND " + date(entidad) + "<:fin" + (entidad ? " AND x.id_entidad=:entidad" : ""); }
    private Map<String,Object> params(Long entidad, LocalDate desde, LocalDate hasta) {
        Map<String,Object> p=new HashMap<>(); p.put("desde", Timestamp.valueOf(desde.atStartOfDay()));
        p.put("fin", Timestamp.valueOf(hasta.plusDays(1).atStartOfDay())); p.put("entidad", entidad); return p;
    }
    public Resumen resumen(String modo, String ambito, Long entidad, String nombre, LocalDate desde, LocalDate hasta) {
        boolean saip=modo.equals("entidad"); var p=params(entidad,desde,hasta);
        String from=source(saip)+scope(saip);
        Long total=jdbc.queryForObject("SELECT COUNT(*)"+from,p,Long.class);
        Long con=jdbc.queryForObject("SELECT COUNT(*)"+from+" AND "+evidence(saip),p,Long.class);
        var estados=counts("SELECT x.estado etiqueta,COUNT(*) cantidad"+from+" GROUP BY x.estado ORDER BY x.estado",p);
        var meses=counts("SELECT to_char("+date(saip)+",'YYYY-MM') etiqueta,COUNT(*) cantidad"+from+" GROUP BY 1 ORDER BY 1",p);
        String resultado=saip?"r.tipo_respuesta":"x.resultado";
        var resultados=counts("SELECT "+resultado+" etiqueta,COUNT(*) cantidad"+from+" AND "+resultado+" IS NOT NULL GROUP BY 1 ORDER BY 1",p);
        var plazos=saip ? plazos(from,p) : new PlazoAtencionReporte.Resultado(0,null);
        return new Resumen(modo,ambito,entidad,nombre,desde,hasta,LocalDateTime.now(),total,con,estados,meses,resultados,
            saip ? "Solicitudes registradas en la entidad actual dentro del periodo. En plazo usa la fecha límite ya guardada y la fecha de la respuesta. No acredita entrega ni notificación eficaz."
                : "Apelaciones registradas en la plataforma dentro del periodo. Resolución final registrada no acredita firma, emisión ni notificación eficaz.",
            saip ? plazos.enPlazoLegal() : null, plazos.tiempoPromedioDiasHabiles());
    }
    private PlazoAtencionReporte.Resultado plazos(String from, Map<String,Object> p) {
        var filas=jdbc.query("SELECT x.fecha_presentacion presentacion, x.fecha_limite limite, r.fecha_respuesta respuesta"+from,p,(r,n)->new PlazoAtencionReporte.Muestra(
            r.getTimestamp("presentacion").toLocalDateTime().toLocalDate(),
            r.getDate("limite")==null?null:r.getDate("limite").toLocalDate(),
            r.getTimestamp("respuesta")==null?null:r.getTimestamp("respuesta").toLocalDateTime().toLocalDate()));
        return PlazoAtencionReporte.calcular(filas, LocalDate.now());
    }
    private List<Conteo> counts(String sql,Map<String,Object> p) { return jdbc.query(sql,p,(r,n)->new Conteo(r.getString("etiqueta"),r.getLong("cantidad"))); }
    public Pagina detalle(String modo,Long entidad,LocalDate desde,LocalDate hasta,int page,int size,String query,String estado) {
        boolean saip=modo.equals("entidad"); var p=params(entidad,desde,hasta); p.put("limite",size);p.put("offset",Math.multiplyExact(page,size));
        String from=source(saip)+scope(saip);
        if(estado!=null&&!estado.isBlank()) { from+=" AND x.estado=:estado";p.put("estado",estado); }
        if(query!=null&&!query.isBlank()) {
            from+=" AND (lower(x.expediente) LIKE :busqueda ESCAPE '!' OR lower("+(saip?"x.asunto":"COALESCE(s.asunto,x.resumen_solicitud_original,'')")+") LIKE :busqueda ESCAPE '!')";
            p.put("busqueda","%"+query.trim().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%");
        }
        long total=jdbc.queryForObject("SELECT COUNT(*)"+from,p,Long.class);
        String id=saip?"x.id_solicitud":"x.id_apelacion";
        String fields=id+" id,x.expediente,"+date(saip)+" fecha,"+(saip?"x.asunto":"COALESCE(s.asunto,x.resumen_solicitud_original)")+" asunto,"
            +(saip?"e.nombre":"COALESCE(e.nombre,x.entidad_externa_nombre)")+" entidad,x.estado,"+(saip?"r.tipo_respuesta":"x.resultado")+" resultado,"+evidence(saip)+" actuacion";
        var rows=jdbc.query("SELECT "+fields+from+" ORDER BY "+date(saip)+" DESC,"+id+" DESC LIMIT :limite OFFSET :offset",p,
            (r,n)->new Fila(r.getLong("id"),r.getString("expediente"),r.getTimestamp("fecha").toLocalDateTime(),r.getString("asunto"),r.getString("entidad"),r.getString("estado"),r.getString("resultado"),r.getBoolean("actuacion")));
        return new Pagina(rows,total,(int)((total+size-1)/size),page,size);
    }
}
