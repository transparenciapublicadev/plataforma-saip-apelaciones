package pe.gob.saip.backend.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.*;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Institutional scope is derived exclusively from the authenticated account. */
@Service
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class ReporteInstitucionalService {
    private final AutorizacionRecursosService auth;
    private final FuncionarioRepository funcionarios;
    private final ReporteInstitucionalQueryRepository queries;
    private final ReporteBorradorRepository drafts;
    private final ReporteConsultaRepository consultas;
    private static final Set<String> SAIP=Set.of("frasaiNombre","frasaiCargo","frasaiDesignacion","factores","factoresOtros","buenasPracticas","necesidades","denunciasRecibidas","comunicacionesSTPAD","pasInstaurados","observaciones");
    private static final Set<String> TTAIP=Set.of("responsable","cargo","conclusiones","recomendaciones");
    public ReporteInstitucionalService(AutorizacionRecursosService auth,FuncionarioRepository funcionarios,ReporteInstitucionalQueryRepository queries,ReporteBorradorRepository drafts,ReporteConsultaRepository consultas) {
        this.auth=auth;this.funcionarios=funcionarios;this.queries=queries;this.drafts=drafts;this.consultas=consultas;
    }
    private record Scope(String key,Long entity,String name,Long actor) { }
    private Scope scope(String modo) {
        Usuario actor=auth.obtenerUsuarioActual();
        if(!Boolean.TRUE.equals(actor.getActivo())) throw new AccessDeniedException("Cuenta no disponible");
        if("entidad".equals(modo)) {
            if(actor.getTipoUsuario()!=Usuario.TipoUsuario.FUNCIONARIO) throw new AccessDeniedException("Requiere acceso institucional de entidad");
            var f=funcionarios.findById(actor.getIdUsuario()).orElseThrow(()->new AccessDeniedException("Funcionario no disponible"));
            if(f.getEntidad()==null) throw new AccessDeniedException("Entidad no disponible");
            return new Scope("entidad:"+f.getEntidad().getId(),f.getEntidad().getId(),f.getEntidad().getNombre(),actor.getIdUsuario());
        }
        if(!"ttaip".equals(modo)) throw new IllegalArgumentException("Ámbito de reporte inválido");
        if(actor.getTipoUsuario()!=Usuario.TipoUsuario.TTAIP) throw new AccessDeniedException("Requiere acceso TTAIP");
        return new Scope("ttaip",null,null,actor.getIdUsuario());
    }
    private void period(LocalDate desde,LocalDate hasta) {
        if(desde==null||hasta==null||hasta.isBefore(desde)||ChronoUnit.DAYS.between(desde,hasta)>366||desde.getYear()<1900||hasta.getYear()>9998)
            throw new IllegalArgumentException("Seleccione un periodo válido de hasta 367 días");
    }
    private void page(int page,int size) { if(page<0||page>100000||size<1||size>100) throw new IllegalArgumentException("Paginación inválida: tamaño entre 1 y 100"); }
    public Resumen resumen(String modo,LocalDate desde,LocalDate hasta) {
        var s=scope(modo);period(desde,hasta);return queries.resumen(modo,s.key(),s.entity(),s.name(),desde,hasta);
    }
    public Pagina detalle(String modo,LocalDate desde,LocalDate hasta,int page,int size,String query,String estado) {
        var s=scope(modo);period(desde,hasta);page(page,size);
        if(query!=null&&query.length()>120) throw new IllegalArgumentException("La búsqueda admite hasta 120 caracteres");
        if(estado!=null&&!estado.isBlank()) {
            try { if(modo.equals("entidad")) pe.gob.saip.backend.model.entity.Solicitud.EstadoSolicitud.valueOf(estado); else pe.gob.saip.backend.model.entity.Apelacion.EstadoApelacion.valueOf(estado); }
            catch(IllegalArgumentException e) { throw new IllegalArgumentException("Estado de reporte inválido"); }
        }
        return queries.detalle(modo,s.entity(),desde,hasta,page,size,query,estado);
    }
    public Borrador borrador(String modo,LocalDate desde,LocalDate hasta) {
        var s=scope(modo);period(desde,hasta);return drafts.find(s.key(),desde,hasta,false).orElseThrow(()->new RecursoNoEncontradoException("No existe borrador para este periodo"));
    }
    public Historial historial(String modo,int page,int size) { var s=scope(modo);page(page,size);return consultas.history(s.key(),page,size); }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void registrarConsulta(String modo, Resumen resumen) {
        var s=scope(modo);period(resumen.desde(),resumen.hasta());
        consultas.upsert(s.key(),resumen,s.actor());
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Borrador guardar(String modo,LocalDate desde,LocalDate hasta,Guardar input) {
        var s=scope(modo);period(desde,hasta);
        if(input.operacionId()==null||input.cualitativo()==null) throw new IllegalArgumentException("Operación y contenido requeridos");
        var allowed=modo.equals("entidad")?SAIP:TTAIP;
        Map<String,String> content=new TreeMap<>();
        input.cualitativo().forEach((k,v)->{
            if(!allowed.contains(k)||v==null||v.length()>4000) throw new IllegalArgumentException("Campo cualitativo inválido");
            if(Set.of("denunciasRecibidas","comunicacionesSTPAD","pasInstaurados").contains(k)&&!v.isBlank()&&!v.matches("[0-9]{1,5}")) throw new IllegalArgumentException("Los conteos declarados deben ser enteros entre 0 y 99999");
            content.put(k,v.trim());
        });
        var prior=drafts.find(s.key(),desde,hasta,true);
        if(prior.isPresent()) {
            var b=prior.get();
            if(b.operacionId().equals(input.operacionId())) {
                if(!b.cualitativo().equals(content)) throw new ConflictoEstadoException("La operación ya se utilizó con otro contenido");
                return b;
            }
            if(!Objects.equals(input.version(),b.version())) throw new ConflictoEstadoException("El borrador cambió; recupere la versión actual antes de guardar");
        } else if(input.version()!=null) throw new ConflictoEstadoException("El borrador esperado no existe");
        var snapshot=queries.resumen(modo,s.key(),s.entity(),s.name(),desde,hasta);
        var b=new Borrador(prior.map(Borrador::id).orElseGet(UUID::randomUUID),modo,desde,hasta,prior.map(x->x.version()+1).orElse(0L),input.operacionId(),content,snapshot,LocalDateTime.now(),"BORRADOR");
        drafts.save(b,s.key(),s.actor(),prior.isEmpty());
        return b;
    }
}
