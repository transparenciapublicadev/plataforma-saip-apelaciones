package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Contenido público del centro de ayuda")
public record AyudaPublicaDTO(
        List<CategoriaAyudaDTO> categorias,
        ContactoAyudaDTO contacto
) {

    public record CategoriaAyudaDTO(
            String id,
            String titulo,
            String icono,
            String colorAcento,
            List<PreguntaAyudaDTO> preguntas
    ) {}

    public record PreguntaAyudaDTO(
            String pregunta,
            String respuesta
    ) {}

    public record ContactoAyudaDTO(
            String telefono,
            String correo,
            String direccion
    ) {}
}
