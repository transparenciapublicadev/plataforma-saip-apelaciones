package pe.gob.saip.backend.repository;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** One stored consultation per institutional scope and period. Shared by the officials of that scope. */
@Repository
public class ReporteConsultaRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public ReporteConsultaRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void upsert(String ambito, Resumen resumen, Long autor) {
        var p = new HashMap<String, Object>();
        p.put("id", UUID.randomUUID());
        p.put("ambito", ambito);
        p.put("modo", resumen.modo());
        p.put("desde", resumen.desde());
        p.put("hasta", resumen.hasta());
        p.put("consultado", LocalDateTime.now());
        p.put("autor", autor);
        p.put("total", resumen.total());
        p.put("con", resumen.conActuacion());
        p.put("plazo", resumen.enPlazoLegal());
        p.put("promedio", resumen.tiempoPromedioDiasHabiles());
        jdbc.update("""
            INSERT INTO reportes_institucionales_consultas
            (id,ambito,modo,desde,hasta,consultado,id_autor,total,con_actuacion,en_plazo_legal,tiempo_promedio_dias)
            VALUES (:id,:ambito,:modo,:desde,:hasta,:consultado,:autor,:total,:con,:plazo,:promedio)
            ON CONFLICT (ambito, desde, hasta) DO UPDATE SET
            consultado=EXCLUDED.consultado, id_autor=EXCLUDED.id_autor, total=EXCLUDED.total,
            con_actuacion=EXCLUDED.con_actuacion, en_plazo_legal=EXCLUDED.en_plazo_legal,
            tiempo_promedio_dias=EXCLUDED.tiempo_promedio_dias
            """, p);
    }

    public Historial history(String ambito, int page, int size) {
        var p = Map.<String, Object>of("ambito", ambito, "offset", Math.multiplyExact(page, size), "limite", size);
        long total = jdbc.queryForObject("""
            SELECT (
              SELECT COUNT(*) FROM reportes_institucionales_consultas WHERE ambito=:ambito
            ) + (
              SELECT COUNT(*) FROM reportes_institucionales_borradores b WHERE b.ambito=:ambito
              AND NOT EXISTS (
                SELECT 1 FROM reportes_institucionales_consultas c
                WHERE c.ambito=b.ambito AND c.desde=b.desde AND c.hasta=b.hasta
              )
            )
            """, p, Long.class);
        var rows = jdbc.query("""
            WITH periodos AS (
              SELECT c.id, c.modo, c.desde, c.hasta, c.consultado, c.id_autor, c.total, c.con_actuacion,
                     c.en_plazo_legal, c.tiempo_promedio_dias
              FROM reportes_institucionales_consultas c WHERE c.ambito=:ambito
              UNION ALL
              SELECT b.id, b.modo, b.desde, b.hasta, b.actualizado, b.id_autor,
                     COALESCE((b.resumen::json->>'total')::bigint, 0),
                     COALESCE((b.resumen::json->>'conActuacion')::bigint, 0),
                     CASE WHEN b.resumen::json->>'enPlazoLegal' IS NULL OR b.resumen::json->>'enPlazoLegal'='null' THEN NULL
                          ELSE (b.resumen::json->>'enPlazoLegal')::bigint END,
                     CASE WHEN b.resumen::json->>'tiempoPromedioDiasHabiles' IS NULL OR b.resumen::json->>'tiempoPromedioDiasHabiles'='null' THEN NULL
                          ELSE (b.resumen::json->>'tiempoPromedioDiasHabiles')::numeric END
              FROM reportes_institucionales_borradores b
              WHERE b.ambito=:ambito AND NOT EXISTS (
                SELECT 1 FROM reportes_institucionales_consultas c
                WHERE c.ambito=b.ambito AND c.desde=b.desde AND c.hasta=b.hasta)
            )
            SELECT p.id, p.modo, p.desde, p.hasta, p.consultado, p.total, p.con_actuacion, p.en_plazo_legal,
                   p.tiempo_promedio_dias, COALESCE(f.nombre_completo, m.nombre_completo, 'Funcionario') autor, b.version version_borrador
            FROM periodos p
            LEFT JOIN funcionarios f ON f.id_usuario=p.id_autor
            LEFT JOIN miembros_ttaip m ON m.id_usuario=p.id_autor
            LEFT JOIN reportes_institucionales_borradores b ON b.ambito=:ambito AND b.desde=p.desde AND b.hasta=p.hasta
            ORDER BY p.consultado DESC, p.id DESC
            LIMIT :limite OFFSET :offset
            """, p, (r, n) -> new Consulta(
                r.getObject("id", UUID.class), r.getString("modo"), r.getDate("desde").toLocalDate(), r.getDate("hasta").toLocalDate(),
                r.getTimestamp("consultado").toLocalDateTime(), r.getString("autor"), r.getLong("total"), r.getLong("con_actuacion"),
                r.getObject("en_plazo_legal") == null ? null : r.getLong("en_plazo_legal"),
                r.getObject("tiempo_promedio_dias") == null ? null : r.getBigDecimal("tiempo_promedio_dias").doubleValue(),
                r.getObject("version_borrador") == null ? null : r.getLong("version_borrador")));
        return new Historial(rows, total, (int) ((total + size - 1) / size), page, size);
    }
}
