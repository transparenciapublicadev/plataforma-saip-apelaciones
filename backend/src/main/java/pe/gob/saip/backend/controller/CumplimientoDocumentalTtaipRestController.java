package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.service.CumplimientoDocumentalTtaipService;
import pe.gob.saip.backend.service.CumplimientoDocumentalTtaipService.ConsultaCumplimientoTtaip;
import pe.gob.saip.backend.service.CumplimientoDocumentalTtaipService.FaseCumplimientoTtaip;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ttaip/expedientes/{expedienteId}/cumplimiento-documental")
public class CumplimientoDocumentalTtaipRestController {
    private final CumplimientoDocumentalTtaipService cumplimiento;

    public record EntregaCumplimientoTtaip(@NotNull UUID operacion,
            @NotNull @Schema(type = "string", format = "binary") MultipartFile respuesta,
            @ArraySchema(schema = @Schema(type = "string", format = "binary")) List<MultipartFile> anexos) {}

    public record ValidacionEntregaCumplimientoTtaip(@NotNull UUID operacion, @NotNull LocalDate fechaEficacia,
            @NotNull @Schema(type = "string", format = "binary") MultipartFile cargo,
            @NotNull @Schema(type = "string", format = "binary") MultipartFile acuse) {}

    public record RemisionCumplimientoTtaip(@NotNull UUID operacion, @NotBlank @Size(max = 120) String numeroOficio,
            @NotBlank @Size(max = 2000) String fundamento,
            @NotNull @Schema(type = "string", format = "binary") MultipartFile oficio,
            @ArraySchema(schema = @Schema(type = "string", format = "binary")) List<MultipartFile> anexos) {}

    @GetMapping
    public ConsultaCumplimientoTtaip consultar(@PathVariable Long expedienteId) {
        return cumplimiento.consultar(expedienteId);
    }

    @PostMapping(value = "/entrega", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, schema = @Schema(implementation = EntregaCumplimientoTtaip.class))))
    public FaseCumplimientoTtaip entregar(@PathVariable Long expedienteId,
            @Parameter(hidden = true) @Valid @ModelAttribute EntregaCumplimientoTtaip entrega) {
        return cumplimiento.entregar(expedienteId, entrega.operacion(), entrega.respuesta(), entrega.anexos());
    }

    @PostMapping(value = "/validacion-entrega", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, schema = @Schema(implementation = ValidacionEntregaCumplimientoTtaip.class))))
    public FaseCumplimientoTtaip validarEntrega(@PathVariable Long expedienteId,
            @Parameter(hidden = true) @Valid @ModelAttribute ValidacionEntregaCumplimientoTtaip validacion) {
        return cumplimiento.validarEntrega(expedienteId, validacion.operacion(), validacion.fechaEficacia(),
                validacion.cargo(), validacion.acuse());
    }

    @PostMapping(value = "/remision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, schema = @Schema(implementation = RemisionCumplimientoTtaip.class))))
    public FaseCumplimientoTtaip remitir(@PathVariable Long expedienteId,
            @Parameter(hidden = true) @Valid @ModelAttribute RemisionCumplimientoTtaip remision) {
        return cumplimiento.remitir(expedienteId, remision.operacion(), remision.numeroOficio(), remision.fundamento(),
                remision.oficio(), remision.anexos());
    }
}
