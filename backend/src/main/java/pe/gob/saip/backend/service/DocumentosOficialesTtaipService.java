package pe.gob.saip.backend.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class DocumentosOficialesTtaipService {
    private static final String RESOLUCION = "RESOLUCION";
    private static final List<String> CEDULAS = List.of("CIUDADANO", "ENTIDAD_PUBLICA");
    private static final Pattern EXTRA = Pattern.compile("(CARTA|OFICIO)-[a-f0-9-]{36}");

    private final DocumentoPreparadoTtaipRepository preparados;
    private final ResolucionRepository resoluciones;
    private final CedulaNotificacionRepository cedulas;
    private final SalaTtaipRepository salas;
    private final ExpedienteTtaipRepository expedientes;
    private final TransicionesApelacionTtaipService transiciones;
    private final AutorizacionRecursosService autorizacion;
    private final DocumentoService documentos;
    private final EntityManager em;

    public record Preparado(String clave, String decision, String numero, String sala, DocumentoMetadataDTO archivo) {
        static Preparado from(DocumentoPreparadoTtaip d) {
            return new Preparado(d.getClave(), d.getDecision().name(), d.getNumero(),
                    d.getSala() == null ? null : d.getSala().getNombre(),
                    d.getDocumento() == null ? null : DocumentoMetadataDTO.from(d.getDocumento()));
        }
    }

    @Transactional(readOnly = true)
    public List<Preparado> listar(Long expedienteId, Resolucion.TipoResolucion etapa) {
        autorizacion.verificarTtaipOAdministrador();
        expediente(expedienteId);
        return pendientes(expedienteId, etapa).stream().map(Preparado::from).toList();
    }

    @Transactional
    public Preparado preparar(Long expedienteId, Resolucion.TipoResolucion etapa, String clave,
                               Resolucion.DecisionResolucion decision, String sala, String numeroExterno,
                               MultipartFile archivo) {
        autorizacion.verificarTtaipOAdministrador();
        ExpedienteTtaip expediente = expediente(expedienteId);
        Apelacion apelacion = transiciones.bloquear(expediente.getApelacion().getId());
        transiciones.validarActuacion(apelacion, etapa, decision);
        boolean extra = EXTRA.matcher(clave).matches();
        if (!RESOLUCION.equals(clave) && !CEDULAS.contains(clave) && !extra) {
            throw new IllegalArgumentException("Tipo de documento desconocido");
        }
        if ("ENTIDAD_PUBLICA".equals(clave) && decision == Resolucion.DecisionResolucion.INADMISIBLE) {
            throw new IllegalArgumentException("La inadmisibilidad se notifica solo al recurrente");
        }
        if (extra && (archivo == null || numeroExterno == null || numeroExterno.isBlank()
                || numeroExterno.length() > 120)) {
            throw new IllegalArgumentException("Registre el número propio y el archivo firmado de la carta u oficio");
        }
        var documento = pendientes(expedienteId, etapa).stream().filter(d -> d.getClave().equals(clave))
                .findFirst().orElseGet(() -> nuevo(expediente, etapa, clave, decision, sala, numeroExterno));
        if (documento.getDecision() != decision) {
            if (archivo == null) return Preparado.from(documento);
            documento.setDecision(decision);
        }
        if (archivo != null) {
            if (extra) documento.setNumero(numeroExterno.trim());
            validarPdf(archivo);
            if (documento.getDocumento() != null) documento.getDocumento().setEstado(Documento.EstadoDocumento.ELIMINADO);
            Documento firmado = new Documento();
            firmado.setTipoDocumento(RESOLUCION.equals(clave) ? Documento.TipoDocumento.RESOLUCION_TTAIP
                    : extra ? Documento.TipoDocumento.OFICIO_CARTA_TTAIP : Documento.TipoDocumento.CEDULA_NOTIFICACION);
            firmado.setBorradorTtaip(true);
            documento.setDocumento(documentos.subirActoTtaip(archivo, firmado, null));
        }
        return Preparado.from(preparados.save(documento));
    }

    private DocumentoPreparadoTtaip nuevo(ExpedienteTtaip expediente, Resolucion.TipoResolucion etapa, String clave,
                                         Resolucion.DecisionResolucion decision, String sala, String numeroExterno) {
        DocumentoPreparadoTtaip documento = new DocumentoPreparadoTtaip();
        documento.setExpediente(expediente);
        documento.setEtapa(etapa);
        documento.setClave(clave);
        documento.setDecision(decision);
        if (RESOLUCION.equals(clave)) {
            if (!"PRIMERA SALA".equals(sala) && !"SEGUNDA SALA".equals(sala)) {
                throw new IllegalArgumentException("Seleccione Primera Sala o Segunda Sala");
            }
            SalaTtaip colegiada = salas.findAll().stream().filter(s -> sala.equalsIgnoreCase(s.getNombre()))
                    .max(java.util.Comparator.comparing(SalaTtaip::getId))
                    .orElseThrow(() -> new ConflictoEstadoException("La sala seleccionada aún no está registrada"));
            documento.setSala(colegiada);
            documento.setNumero(numeroResolucion(colegiada));
        } else if (CEDULAS.contains(clave)) {
            documento.setNumero(numeroCedula());
        } else {
            documento.setNumero(numeroExterno.trim());
        }
        return documento;
    }

    List<DocumentoPreparadoTtaip> validarEmision(Resolucion resolucion) {
        var pendientes = pendientes(resolucion.getExpedienteTtaip().getId(), resolucion.getTipoResolucion());
        if (pendientes.isEmpty()) return pendientes;
        var requeridos = new ArrayList<>(List.of(RESOLUCION, "CIUDADANO"));
        if (resolucion.getDecision() != Resolucion.DecisionResolucion.INADMISIBLE) requeridos.add("ENTIDAD_PUBLICA");
        for (String clave : requeridos) {
            if (pendientes.stream().noneMatch(d -> clave.equals(d.getClave()) && apto(d, resolucion))) {
                throw new ConflictoEstadoException("Falta el documento firmado de " + clave + " para esta decisión");
            }
        }
        return pendientes.stream().filter(d -> (requeridos.contains(d.getClave()) || EXTRA.matcher(d.getClave()).matches())
                && apto(d, resolucion)).toList();
    }

    private boolean apto(DocumentoPreparadoTtaip preparado, Resolucion resolucion) {
        return preparado.getDecision() == resolucion.getDecision() && preparado.getDocumento() != null
                && preparado.getDocumento().getEstado() == Documento.EstadoDocumento.ACTIVO;
    }

    void aplicarNumero(Resolucion resolucion) {
        var documentos = validarEmision(resolucion);
        documentos.stream().filter(d -> RESOLUCION.equals(d.getClave())).findFirst().ifPresent(d -> {
            resolucion.setNumeroResolucion(d.getNumero());
            resolucion.setSalaTtaip(d.getSala());
            resolucion.setActosDocumentales(true);
        });
    }

    void publicar(Resolucion resolucion) {
        var emitidos = validarEmision(resolucion);
        for (var preparado : emitidos) {
            Documento documento = preparado.getDocumento();
            documento.setBorradorTtaip(false);
            if (CEDULAS.contains(preparado.getClave())) {
                var destinatario = CedulaNotificacion.DestinatarioNotificacion.valueOf(preparado.getClave());
                var cedula = cedulas.findByResolucion_IdResolucionAndDestinatario(resolucion.getId(), destinatario).orElseThrow();
                documento.setCedulaNotificacion(cedula);
                if (cedula.getDocumentos() == null) cedula.setDocumentos(new ArrayList<>());
                if (!cedula.getDocumentos().contains(documento)) cedula.getDocumentos().add(documento);
            } else {
                documento.setResolucion(resolucion);
                if (resolucion.getDocumentos() == null) resolucion.setDocumentos(new ArrayList<>());
                if (!resolucion.getDocumentos().contains(documento)) resolucion.getDocumentos().add(documento);
            }
        }
        pendientes(resolucion.getExpedienteTtaip().getId(), resolucion.getTipoResolucion())
                .forEach(preparado -> preparado.setResolucion(resolucion));
    }

    String numeroReservadoCedula(Resolucion resolucion, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        return pendientes(resolucion.getExpedienteTtaip().getId(), resolucion.getTipoResolucion()).stream()
                .filter(d -> d.getClave().equals(destinatario.name()))
                .findFirst().orElseThrow().getNumero();
    }

    String numeroResolucion(SalaTtaip sala) {
        bloquearCorrelativos();
        int year = LocalDate.now().getYear();
        String fragmento = "-" + year + "-JUS/TTAIP";
        long ultimo = Stream.concat(resoluciones.findByNumeroResolucionContaining(fragmento).stream()
                        .map(Resolucion::getNumeroResolucion),
                preparados.findByClaveAndNumeroContaining(RESOLUCION, fragmento).stream()
                        .map(DocumentoPreparadoTtaip::getNumero))
                .mapToLong(n -> secuencia(n.replace("RESOLUCIÓN N.° ", ""), 1595)).max().orElse(1595);
        return "RESOLUCIÓN N.° %06d-%d-JUS/TTAIP-%s".formatted(ultimo + 1, year, sala.getNombre());
    }

    String numeroCedula() {
        bloquearCorrelativos();
        int year = LocalDate.now().getYear();
        String sufijo = "-" + year + "-JUS/TTAIP";
        long ultimo = Stream.concat(cedulas.findByNumeroCedulaEndingWith(sufijo).stream()
                        .map(CedulaNotificacion::getNumeroCedula),
                preparados.findByClaveInAndNumeroEndingWith(CEDULAS, sufijo).stream()
                        .map(DocumentoPreparadoTtaip::getNumero))
                .mapToLong(n -> secuencia(n, 15202)).max().orElse(15202);
        return "%05d%s".formatted(ultimo + 1, sufijo);
    }

    private void bloquearCorrelativos() {
        em.createNativeQuery("select 1 from pg_advisory_xact_lock(734591019)").getSingleResult();
    }

    private static long secuencia(String numero, long base) {
        try {
            return Math.max(base, Long.parseLong(numero.substring(0, numero.indexOf('-'))));
        } catch (IllegalArgumentException | IndexOutOfBoundsException e) {
            return base;
        }
    }

    private List<DocumentoPreparadoTtaip> pendientes(Long id, Resolucion.TipoResolucion etapa) {
        return preparados.findByExpediente_IdExpedienteTtaipAndEtapaAndResolucionIsNullOrderById(id, etapa);
    }

    private ExpedienteTtaip expediente(Long id) {
        return expedientes.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("Expediente no encontrado"));
    }

    static void validarPdf(MultipartFile archivo) {
        if (archivo.isEmpty() || archivo.getOriginalFilename() == null
                || !archivo.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new IllegalArgumentException("Adjunte el documento firmado en PDF");
        }
        try (var contenido = archivo.getInputStream()) {
            if (!java.util.Arrays.equals(contenido.readNBytes(5), "%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                throw new IllegalArgumentException("El contenido del archivo no corresponde a un PDF");
            }
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("No se pudo leer el PDF firmado", e);
        }
    }
}
