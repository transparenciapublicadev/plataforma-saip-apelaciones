package pe.gob.saip.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.config.ClockConfig;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.BorradorSaipDTO;
import pe.gob.saip.backend.model.dto.GuardarBorradorSaipRequest;
import pe.gob.saip.backend.model.entity.BorradorSaip;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.repository.BorradorSaipRepository;
import pe.gob.saip.backend.repository.EntidadRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/** Guarda la preparación de una SAIP. Presentarla sigue siendo el alta de la solicitud. */
@Service
@RequiredArgsConstructor
public class BorradorSaipService {

    static final int MAXIMO_POR_CIUDADANO = 20;
    private static final Set<String> CANALES = Set.of("CORREO", "DOMICILIO", "CASILLA");

    private final BorradorSaipRepository borradores;
    private final EntidadRepository entidades;
    private final AutorizacionRecursosService autorizacion;
    private final Clock clock;

    @Transactional(readOnly = true)
    public BorradorSaipDTO obtener(Long id) {
        Ciudadano ciudadano = autorizacion.ciudadanoDeLaSesion();
        return borradores.findByIdBorradorAndCiudadano_IdUsuario(id, ciudadano.getIdUsuario())
                .map(BorradorSaipDTO::from)
                .orElseThrow(() -> new RecursoNoEncontradoException("Borrador no encontrado"));
    }

    @Transactional(readOnly = true)
    public List<BorradorSaipDTO> listar() {
        Ciudadano ciudadano = autorizacion.ciudadanoDeLaSesion();
        return borradores.findByCiudadano_IdUsuarioOrderByActualizadoDesc(ciudadano.getIdUsuario()).stream()
                .map(BorradorSaipDTO::from)
                .toList();
    }

    @Transactional
    public BorradorSaipDTO guardar(Long id, GuardarBorradorSaipRequest datos) {
        if (!tieneContenido(datos)) {
            throw new IllegalArgumentException("Escriba al menos un dato antes de guardar el borrador.");
        }
        Ciudadano ciudadano = autorizacion.ciudadanoDeLaSesion();
        BorradorSaip borrador = id == null
                ? nuevo(ciudadano)
                : borradores.findByIdBorradorAndCiudadano_IdUsuario(id, ciudadano.getIdUsuario())
                    .orElseThrow(() -> new RecursoNoEncontradoException("Borrador no encontrado"));
        aplicar(borrador, datos);
        return BorradorSaipDTO.from(borradores.save(borrador));
    }

    @Transactional
    public void eliminar(Long id) {
        Ciudadano ciudadano = autorizacion.ciudadanoDeLaSesion();
        BorradorSaip borrador = borradores.findByIdBorradorAndCiudadano_IdUsuario(id, ciudadano.getIdUsuario())
                .orElseThrow(() -> new RecursoNoEncontradoException("Borrador no encontrado"));
        borradores.delete(borrador);
    }

    private BorradorSaip nuevo(Ciudadano ciudadano) {
        if (borradores.countByCiudadano_IdUsuario(ciudadano.getIdUsuario()) >= MAXIMO_POR_CIUDADANO) {
            throw new IllegalArgumentException("Ya tiene 20 borradores. Continúe o descarte uno antes de guardar otro.");
        }
        LocalDateTime ahora = LocalDateTime.now(clock.withZone(ClockConfig.ZONA_LIMA));
        BorradorSaip borrador = new BorradorSaip();
        borrador.setCiudadano(ciudadano);
        borrador.setCreado(ahora);
        borrador.setActualizado(ahora);
        return borrador;
    }

    private void aplicar(BorradorSaip borrador, GuardarBorradorSaipRequest datos) {
        borrador.setEntidad(resolverEntidad(datos.entidadId()));
        borrador.setAsunto(texto(datos.asunto(), 500));
        borrador.setDescripcion(texto(datos.descripcion(), 20000));
        borrador.setTipoInformacion(texto(datos.tipoInformacion(), 100));
        borrador.setOficinaDestinataria(texto(datos.oficinaDestinataria(), 160));
        borrador.setFormatoCorreo(datos.formatoCorreo());
        borrador.setCopiaSimple(datos.copiaSimple());
        borrador.setCopiaCertificada(datos.copiaCertificada());
        borrador.setSoporteMagnetico(datos.soporteMagnetico());
        borrador.setCanalNotificacion(canal(datos.canalNotificacion()));
        borrador.setAceptaCanal(datos.aceptaCanal());
        borrador.setConsentimientoDatos(datos.consentimientoDatos());
        borrador.setDeclaraVeracidad(datos.declaraVeracidad());
        borrador.setPaso((short) datos.paso());
        borrador.setActualizado(LocalDateTime.now(clock.withZone(ClockConfig.ZONA_LIMA)));
    }

    private Entidad resolverEntidad(Long entidadId) {
        if (entidadId == null) return null;
        return entidades.findById(entidadId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada"));
    }

    private static boolean tieneContenido(GuardarBorradorSaipRequest datos) {
        return datos.entidadId() != null
                || presente(datos.asunto())
                || presente(datos.descripcion())
                || presente(datos.tipoInformacion())
                || presente(datos.oficinaDestinataria())
                || datos.formatoCorreo()
                || datos.copiaSimple()
                || datos.copiaCertificada()
                || datos.soporteMagnetico()
                || presente(datos.canalNotificacion());
    }

    private static String canal(String valor) {
        String canal = texto(valor, 20);
        if (canal == null) return null;
        String normalizado = canal.toUpperCase();
        if (!CANALES.contains(normalizado)) {
            throw new IllegalArgumentException("El medio de notificación del borrador no es válido.");
        }
        return normalizado;
    }

    private static String texto(String valor, int maximo) {
        if (valor == null) return null;
        String limpio = valor.trim();
        if (limpio.isEmpty()) return null;
        return limpio.length() <= maximo ? limpio : limpio.substring(0, maximo);
    }

    private static boolean presente(String valor) {
        return valor != null && !valor.isBlank();
    }
}
