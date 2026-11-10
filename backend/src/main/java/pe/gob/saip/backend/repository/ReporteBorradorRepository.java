package pe.gob.saip.backend.repository;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.*;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDate;
import java.util.*;

/** Persists drafts only; immutable report receipts and official issuance are separate use cases. */
@Repository
public class ReporteBorradorRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final JsonMapper json;
    public ReporteBorradorRepository(NamedParameterJdbcTemplate jdbc, JsonMapper json) { this.jdbc=jdbc; this.json=json; }
    private Borrador map(java.sql.ResultSet r, int n) throws java.sql.SQLException {
        Map<?,?> raw=json.readValue(r.getString("cualitativo"),Map.class);
        Map<String,String> fields=new LinkedHashMap<>();raw.forEach((k,v)->fields.put((String)k,(String)v));
        return new Borrador(r.getObject("id",UUID.class),r.getString("modo"),r.getDate("desde").toLocalDate(),r.getDate("hasta").toLocalDate(),
            r.getLong("version"),r.getObject("operacion_id",UUID.class),fields,json.readValue(r.getString("resumen"),Resumen.class),
            r.getTimestamp("actualizado").toLocalDateTime(),"BORRADOR");
    }
    public Optional<Borrador> find(String scope,LocalDate desde,LocalDate hasta,boolean lock) {
        return jdbc.query("SELECT * FROM reportes_institucionales_borradores WHERE ambito=:ambito AND desde=:desde AND hasta=:hasta"+(lock?" FOR UPDATE":""),
            Map.of("ambito",scope,"desde",desde,"hasta",hasta),this::map).stream().findFirst();
    }
    public Historial history(String scope,int page,int size) {
        var p=Map.<String,Object>of("ambito",scope,"offset",Math.multiplyExact(page,size),"limite",size);
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM reportes_institucionales_borradores WHERE ambito=:ambito",p,Long.class);
        var rows=jdbc.query("SELECT * FROM reportes_institucionales_borradores WHERE ambito=:ambito ORDER BY actualizado DESC,id DESC LIMIT :limite OFFSET :offset",p,this::map);
        return new Historial(rows,total,(int)((total+size-1)/size),page,size);
    }
    public void save(Borrador b,String scope,Long actor,boolean insert) {
        var p=new HashMap<String,Object>();p.put("id",b.id());p.put("ambito",scope);p.put("modo",b.modo());p.put("desde",b.desde());p.put("hasta",b.hasta());
        p.put("version",b.version());p.put("op",b.operacionId());p.put("cual",json.writeValueAsString(b.cualitativo()));p.put("resumen",json.writeValueAsString(b.resumen()));
        p.put("ahora",b.actualizado());p.put("autor",actor);
        if(insert) jdbc.update("INSERT INTO reportes_institucionales_borradores (id,ambito,modo,desde,hasta,version,operacion_id,cualitativo,resumen,actualizado,id_autor) VALUES (:id,:ambito,:modo,:desde,:hasta,:version,:op,:cual,:resumen,:ahora,:autor)",p);
        else jdbc.update("UPDATE reportes_institucionales_borradores SET version=:version,operacion_id=:op,cualitativo=:cual,resumen=:resumen,actualizado=:ahora,id_autor=:autor WHERE id=:id AND ambito=:ambito",p);
    }
}
