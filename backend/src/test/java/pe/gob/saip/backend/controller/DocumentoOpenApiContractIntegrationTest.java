package pe.gob.saip.backend.controller;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class DocumentoOpenApiContractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void openApiPublishesDocumentRelationsAndSanitizedMetadata() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$['paths']['/api/documentos']['get']['parameters'][*]['name']",
                        hasItem("respuestaId")))
                .andExpect(jsonPath(
                        "$['paths']['/api/documentos/upload']['post']['parameters'][*]['name']",
                        hasItem("respuestaId")))
                .andExpect(jsonPath(
                        "$['components']['schemas']['DocumentoMetadataDTO']['properties']['storageProvider']")
                        .doesNotExist())
                .andExpect(jsonPath(
                        "$['components']['schemas']['DocumentoMetadataDTO']['properties']['storageKey']")
                        .doesNotExist())
                .andExpect(jsonPath(
                        "$['components']['schemas']['DocumentoMetadataDTO']['properties']['storageBucket']")
                        .doesNotExist())
                .andExpect(jsonPath(
                        "$['components']['schemas']['DocumentoDTO']['properties']['rutaArchivo']")
                        .doesNotExist())
                .andExpect(jsonPath(
                        "$['components']['schemas']['SolicitudDTO']['properties']['documentosMetadata']")
                        .exists())
                .andExpect(jsonPath(
                        "$['components']['schemas']['RespuestaDTO']['properties']['documentosMetadata']")
                        .exists())
                .andExpect(jsonPath(
                        "$['components']['schemas']['ExpedienteTtaipDTO']['properties']['documentos']")
                        .exists())
                .andExpect(jsonPath(
                        "$['components']['schemas']['ResolucionDTO']['properties']['documentos']")
                        .exists())
                .andExpect(jsonPath(
                        "$['components']['schemas']['CedulaNotificacionDTO']['properties']['documentos']")
                        .exists())
                .andExpect(jsonPath(
                        "$['components']['schemas']['NotificacionTtaipDTO']['properties']['documentosCedula']")
                        .exists());
    }
}
