package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.model.dto.AyudaPublicaDTO;

import java.util.List;

@RestController
@RequestMapping("/api/public/ayuda")
@Tag(name = "Ayuda pública", description = "Contenido público del centro de ayuda")
public class AyudaPublicaRestController {

    @Operation(summary = "Obtener contenido del centro de ayuda", description = "Devuelve categorías, preguntas frecuentes y contacto institucional")
    @GetMapping
    public ResponseEntity<AyudaPublicaDTO> obtenerAyuda() {
        return ResponseEntity.ok(new AyudaPublicaDTO(
                obtenerCategorias(),
                new AyudaPublicaDTO.ContactoAyudaDTO(
                        "(01) 630-2000",
                        "contacto@saip-tesis.edu",
                        "Universidad · Lima"
                )
        ));
    }

    private List<AyudaPublicaDTO.CategoriaAyudaDTO> obtenerCategorias() {
        return List.of(
                new AyudaPublicaDTO.CategoriaAyudaDTO(
                        "saip",
                        "Solicitudes SAIP",
                        "file",
                        "var(--brand-700)",
                        List.of(
                                pregunta("¿Qué es una solicitud SAIP?",
                                        "Una Solicitud de Acceso a la Información Pública (SAIP) es el mecanismo formal mediante el cual cualquier ciudadano puede solicitar información a una entidad del Estado peruano, en ejercicio del derecho fundamental reconocido por la Constitución y la Ley N° 27806."),
                                pregunta("¿Qué información puedo solicitar?",
                                        "Puede solicitar cualquier información que posea o produzca una entidad pública, salvo aquella que haya sido clasificada como secreta, reservada o confidencial conforme a ley. Esto incluye documentos, contratos, presupuestos, informes y actas."),
                                pregunta("¿Cómo presento una solicitud SAIP?",
                                        "Regístrese en la plataforma con su DNI, complete el formulario indicando la entidad, el asunto y la descripción detallada de la información que solicita; seleccione el formato de respuesta deseado y envíe."),
                                pregunta("¿Cuánto cuesta presentar una SAIP?",
                                        "La presentación es completamente gratuita. La reproducción (copias, CDs, etc.) puede tener un costo que corresponde únicamente al costo de reproducción."),
                                pregunta("¿Cuánto tiempo tiene la entidad para responder?",
                                        "La entidad tiene un plazo máximo de 10 días hábiles para responder, contados desde el día siguiente de su presentación. Si el pedido es amplio, puede notificar una ampliación hasta el día 4 de atención con informe y cronograma de entregas parciales.")
                        )
                ),
                new AyudaPublicaDTO.CategoriaAyudaDTO(
                        "apelaciones",
                        "Apelaciones",
                        "scale",
                        "var(--gold-dark)",
                        List.of(
                                pregunta("¿Cuándo puedo presentar una apelación?",
                                        "Cuando la entidad deniega total o parcialmente su solicitud, o cuando no responde dentro del plazo (silencio administrativo negativo). Plazo: 15 días calendario desde la notificación o vencimiento."),
                                pregunta("¿Qué documentos necesito para apelar?",
                                        "Tres documentos: (1) copia de la SAIP presentada, (2) copia de la respuesta denegatoria (o declaración jurada en silencio administrativo) y (3) escrito fundamentado del recurso."),
                                pregunta("¿Quién resuelve las apelaciones?",
                                        "El Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), órgano colegiado autónomo del Ministerio de Justicia y Derechos Humanos."),
                                pregunta("¿Cuánto demora la resolución?",
                                        "El TTAIP tiene 10 días hábiles para resolver. El proceso completo (calificación, posible subsanación y resolución final) puede tomar entre 15 y 30 días hábiles."),
                                pregunta("¿Qué resultados puede tener mi apelación?",
                                        "Fundada (se ordena entregar la información), Infundada (se confirma la denegación) o Improcedente (no cumple requisitos formales).")
                        )
                ),
                new AyudaPublicaDTO.CategoriaAyudaDTO(
                        "proceso",
                        "Proceso y plazos",
                        "clock",
                        "var(--info)",
                        List.of(
                                pregunta("¿Qué es la subsanación?",
                                        "Cuando la apelación tiene defectos formales, el TTAIP otorga 2 días hábiles para subsanar las observaciones. Si no se subsana, la apelación se archiva."),
                                pregunta("¿Cómo se calculan los días hábiles?",
                                        "De lunes a viernes, excluyendo feriados nacionales y días no laborables del sector público. El conteo inicia desde el día siguiente a la notificación."),
                                pregunta("¿Puedo dar seguimiento a mi solicitud?",
                                        "Sí. La plataforma permite seguimiento en tiempo real. También puede consultar de forma pública con el número de expediente, sin iniciar sesión."),
                                pregunta("¿Qué pasa si la entidad no responde a tiempo?",
                                        "Se configura el silencio administrativo negativo (denegación tácita). Puede presentar su apelación ante el TTAIP.")
                        )
                ),
                new AyudaPublicaDTO.CategoriaAyudaDTO(
                        "cuenta",
                        "Cuenta y registro",
                        "shield",
                        "var(--success)",
                        List.of(
                                pregunta("¿Necesito una cuenta para presentar una SAIP?",
                                        "Sí. El registro es gratuito y solo requiere su DNI, datos personales básicos y un correo electrónico."),
                                pregunta("¿Qué datos necesito para registrarme?",
                                        "DNI (8 dígitos), nombres y apellidos completos, correo válido, teléfono celular (9 dígitos) y una contraseña de al menos 8 caracteres."),
                                pregunta("¿Olvidé mi contraseña, qué hago?",
                                        "Solicite el restablecimiento desde la página de inicio de sesión. Se enviará un enlace de recuperación a su correo registrado.")
                        )
                )
        );
    }

    private AyudaPublicaDTO.PreguntaAyudaDTO pregunta(String pregunta, String respuesta) {
        return new AyudaPublicaDTO.PreguntaAyudaDTO(pregunta, respuesta);
    }
}
