package pe.gob.saip.backend.model.dto;

import pe.gob.saip.backend.model.entity.BorradorSaip;
import pe.gob.saip.backend.model.entity.Entidad;

import java.time.LocalDateTime;

public record BorradorSaipDTO(
        Long id,
        Long entidadId,
        String entidadNombre,
        String asunto,
        String descripcion,
        String tipoInformacion,
        String oficinaDestinataria,
        boolean formatoCorreo,
        boolean copiaSimple,
        boolean copiaCertificada,
        boolean soporteMagnetico,
        String canalNotificacion,
        boolean aceptaCanal,
        boolean consentimientoDatos,
        boolean declaraVeracidad,
        int paso,
        LocalDateTime actualizado
) {
    public static BorradorSaipDTO from(BorradorSaip borrador) {
        Entidad entidad = borrador.getEntidad();
        return new BorradorSaipDTO(
                borrador.getIdBorrador(),
                entidad == null ? null : entidad.getIdEntidad(),
                entidad == null ? null : entidad.getNombre(),
                borrador.getAsunto(),
                borrador.getDescripcion(),
                borrador.getTipoInformacion(),
                borrador.getOficinaDestinataria(),
                borrador.isFormatoCorreo(),
                borrador.isCopiaSimple(),
                borrador.isCopiaCertificada(),
                borrador.isSoporteMagnetico(),
                borrador.getCanalNotificacion(),
                borrador.isAceptaCanal(),
                borrador.isConsentimientoDatos(),
                borrador.isDeclaraVeracidad(),
                borrador.getPaso(),
                borrador.getActualizado());
    }
}
