package com.gestion.misaip.util

import android.content.ContentValues
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Usuario
import com.gestion.misaip.presentation.viewmodel.AdminDashboardUiState
import com.gestion.misaip.presentation.viewmodel.EntidadStatsItem
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Utilidad para exportar reportes estadísticos del panel de administración.
 *
 * Genera archivos en dos formatos:
 * - PDF: Usando android.graphics.pdf.PdfDocument (API nativa, sin dependencias externas)
 * - CSV: Formato universal abierto por Excel, Google Sheets, LibreOffice (sin dependencias)
 *
 * Los archivos se guardan en la carpeta de Descargas del dispositivo
 * usando MediaStore (Android 10+) o acceso directo a /Download (API < 29).
 */
object ReportExportHelper {

    private const val TAG = "ReportExportHelper"
    private val fechaFormato = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.forLanguageTag("es-PE"))
    private val fechaArchivo = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.forLanguageTag("es-PE"))

    // =========================================================================
    // Colores del branding SAIP para PDF
    // =========================================================================
    private val COLOR_BRAND_RED = Color.parseColor("#C8102E")
    private val COLOR_HEADER_BG = Color.parseColor("#C8102E")
    private val COLOR_HEADER_TEXT = Color.WHITE
    private val COLOR_TABLE_HEADER = Color.parseColor("#F5F5F5")
    private val COLOR_TABLE_BORDER = Color.parseColor("#E0E0E0")
    private val COLOR_TEXT_PRIMARY = Color.parseColor("#212121")
    private val COLOR_TEXT_SECONDARY = Color.parseColor("#757575")

    // =========================================================================
    // EXPORTACIÓN PDF — REPORTE GENERAL
    // =========================================================================

    /**
     * Genera un PDF con el reporte general de estadísticas.
     * Incluye: resumen ejecutivo, desglose de solicitudes, apelaciones, usuarios y entidades.
     *
     * @return Ruta del archivo generado, o null si falló
     */
    fun exportarReporteGeneralPDF(context: Context, state: AdminDashboardUiState): String? {
        return try {
            val document = PdfDocument()
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Reporte_General_$timestamp.pdf"

            // Página 1: Resumen ejecutivo
            var pageNumber = 1
            val pageInfo1 = PdfDocument.PageInfo.Builder(595, 842, pageNumber).create() // A4
            val page1 = document.startPage(pageInfo1)
            dibujarPaginaResumenGeneral(page1.canvas, state)
            document.finishPage(page1)

            // Página 2: Desglose por entidades
            if (state.entidadesConStats.isNotEmpty()) {
                pageNumber++
                val pageInfo2 = PdfDocument.PageInfo.Builder(595, 842, pageNumber).create()
                val page2 = document.startPage(pageInfo2)
                dibujarPaginaEntidades(page2.canvas, state)
                document.finishPage(page2)
            }

            val filePath = guardarArchivo(context, document, fileName, "application/pdf")
            document.close()
            filePath
        } catch (e: Exception) {
            Log.e(TAG, "Error generando PDF general", e)
            null
        }
    }

    /**
     * Genera un PDF con el listado detallado de solicitudes SAIP.
     */
    fun exportarSolicitudesPDF(context: Context, solicitudes: List<Solicitud>): String? {
        return try {
            val document = PdfDocument()
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Solicitudes_$timestamp.pdf"

            // Paginación: ~20 solicitudes por página
            val pageSize = 20
            val chunks = solicitudes.chunked(pageSize)

            chunks.forEachIndexed { index, chunk ->
                val pageInfo = PdfDocument.PageInfo.Builder(595, 842, index + 1).create()
                val page = document.startPage(pageInfo)
                dibujarPaginaSolicitudes(page.canvas, chunk, index + 1, chunks.size, solicitudes.size)
                document.finishPage(page)
            }

            if (chunks.isEmpty()) {
                val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
                val page = document.startPage(pageInfo)
                dibujarPaginaSolicitudes(page.canvas, emptyList(), 1, 1, 0)
                document.finishPage(page)
            }

            val filePath = guardarArchivo(context, document, fileName, "application/pdf")
            document.close()
            filePath
        } catch (e: Exception) {
            Log.e(TAG, "Error generando PDF solicitudes", e)
            null
        }
    }

    /**
     * Genera un PDF con el listado detallado de apelaciones TTAIP.
     */
    fun exportarApelacionesPDF(context: Context, apelaciones: List<Apelacion>): String? {
        return try {
            val document = PdfDocument()
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Apelaciones_$timestamp.pdf"

            val pageSize = 18
            val chunks = apelaciones.chunked(pageSize)

            chunks.forEachIndexed { index, chunk ->
                val pageInfo = PdfDocument.PageInfo.Builder(595, 842, index + 1).create()
                val page = document.startPage(pageInfo)
                dibujarPaginaApelaciones(page.canvas, chunk, index + 1, chunks.size, apelaciones.size)
                document.finishPage(page)
            }

            if (chunks.isEmpty()) {
                val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
                val page = document.startPage(pageInfo)
                dibujarPaginaApelaciones(page.canvas, emptyList(), 1, 1, 0)
                document.finishPage(page)
            }

            val filePath = guardarArchivo(context, document, fileName, "application/pdf")
            document.close()
            filePath
        } catch (e: Exception) {
            Log.e(TAG, "Error generando PDF apelaciones", e)
            null
        }
    }

    // =========================================================================
    // EXPORTACIÓN EXCEL (HTML Table → .xls)
    // Excel, Google Sheets y WPS Office abren HTML tables como hojas de cálculo
    // =========================================================================

    private const val MIME_EXCEL = "application/vnd.ms-excel"

    /** Encabezado HTML compatible con Excel/Sheets. */
    private fun htmlHeader(titulo: String, hoja: String = "Reporte"): String = """
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml>
        <x:ExcelWorkbook><x:ExcelWorksheets>
        <x:ExcelWorksheet><x:Name>$hoja</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
        </x:ExcelWorksheets></x:ExcelWorkbook>
        </xml><![endif]-->
        <style>
            td, th { mso-number-format:\@; font-family: Calibri, sans-serif; font-size: 11pt; }
            th { background-color: #C8102E; color: #FFFFFF; font-weight: bold; padding: 6px 10px; }
            td { padding: 4px 10px; border: 1px solid #E0E0E0; }
            .section { background-color: #F5F5F5; font-weight: bold; font-size: 12pt; }
            .number { mso-number-format:0; text-align: right; }
            h2 { font-family: Calibri, sans-serif; color: #C8102E; }
            p  { font-family: Calibri, sans-serif; font-size: 10pt; color: #757575; }
        </style>
        </head>
        <body>
        <h2>$titulo</h2>
    """.trimIndent()

    private const val HTML_FOOTER = "</body></html>"

    /**
     * Genera un archivo Excel (.xls) con el reporte general de estadísticas.
     */
    fun exportarReporteGeneralCSV(context: Context, state: AdminDashboardUiState): String? {
        return try {
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Reporte_General_$timestamp.xls"

            val sb = StringBuilder()
            sb.append(htmlHeader("Reporte General — Sistema MiSAIP", "Reporte General"))
            sb.append("<p>Generado: ${fechaFormato.format(Date())}</p>")

            // Resumen Ejecutivo
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th colspan='2' class='section'>RESUMEN EJECUTIVO</th></tr>")
            sb.append("<tr><th>Métrica</th><th>Valor</th></tr>")
            sb.append("<tr><td>Total Solicitudes SAIP</td><td class='number'>${state.totalSolicitudes}</td></tr>")
            sb.append("<tr><td>Total Apelaciones TTAIP</td><td class='number'>${state.totalApelaciones}</td></tr>")
            sb.append("<tr><td>Total Usuarios Registrados</td><td class='number'>${state.totalUsuarios}</td></tr>")
            sb.append("<tr><td>Apelaciones Resueltas</td><td class='number'>${state.apelacionesResueltas}</td></tr>")
            sb.append("</table><br/>")

            // Solicitudes por Estado
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th colspan='3' class='section'>SOLICITUDES POR ESTADO</th></tr>")
            sb.append("<tr><th>Estado</th><th>Cantidad</th><th>Porcentaje</th></tr>")
            val solEstados = listOf(
                "Pendientes" to state.solicitudesPendientes,
                "Respondidas" to state.solicitudesRespondidas,
                "Denegadas" to state.solicitudesDenegadas,
                "Vencidas" to state.solicitudesVencidas
            )
            solEstados.forEach { (label, value) ->
                val pct = if (state.totalSolicitudes > 0) "%.1f%%".format(value * 100.0 / state.totalSolicitudes) else "0%"
                sb.append("<tr><td>$label</td><td class='number'>$value</td><td class='number'>$pct</td></tr>")
            }
            sb.append("</table><br/>")

            // Apelaciones por Estado
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th colspan='3' class='section'>APELACIONES POR ESTADO</th></tr>")
            sb.append("<tr><th>Estado</th><th>Cantidad</th><th>Porcentaje</th></tr>")
            val apelEstados = listOf(
                "Pendientes" to state.apelacionesPendientes,
                "En Calificación" to state.apelacionesEnCalificacion,
                "Fundadas" to state.apelacionesFundadas,
                "Infundadas" to state.apelacionesInfundadas
            )
            apelEstados.forEach { (label, value) ->
                val pct = if (state.totalApelaciones > 0) "%.1f%%".format(value * 100.0 / state.totalApelaciones) else "0%"
                sb.append("<tr><td>$label</td><td class='number'>$value</td><td class='number'>$pct</td></tr>")
            }
            sb.append("</table><br/>")

            // Usuarios por Tipo
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th colspan='2' class='section'>USUARIOS POR TIPO</th></tr>")
            sb.append("<tr><th>Tipo</th><th>Cantidad</th></tr>")
            sb.append("<tr><td>Ciudadanos</td><td class='number'>${state.ciudadanos}</td></tr>")
            sb.append("<tr><td>Funcionarios</td><td class='number'>${state.funcionarios}</td></tr>")
            sb.append("<tr><td>Vocales TTAIP</td><td class='number'>${state.vocalesTTAIP}</td></tr>")
            sb.append("</table><br/>")

            // Entidades
            if (state.entidadesConStats.isNotEmpty()) {
                sb.append("<table border='1' cellspacing='0'>")
                sb.append("<tr><th colspan='5' class='section'>ESTADÍSTICAS POR ENTIDAD</th></tr>")
                sb.append("<tr><th>Entidad</th><th>Total</th><th>Pendientes</th><th>Respondidas</th><th>Vencidas</th></tr>")
                state.entidadesConStats.forEach { ent ->
                    sb.append("<tr><td>${escaparHtml(ent.nombre)}</td><td class='number'>${ent.solicitudes}</td><td class='number'>${ent.pendientes}</td><td class='number'>${ent.respondidas}</td><td class='number'>${ent.vencidas}</td></tr>")
                }
                sb.append("</table>")
            }

            sb.append(HTML_FOOTER)
            guardarExcel(context, sb.toString(), fileName)
        } catch (e: Exception) {
            Log.e(TAG, "Error generando Excel general", e)
            null
        }
    }

    /**
     * Genera un archivo Excel (.xls) con el listado detallado de solicitudes SAIP.
     */
    fun exportarSolicitudesCSV(context: Context, solicitudes: List<Solicitud>): String? {
        return try {
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Solicitudes_$timestamp.xls"

            val sb = StringBuilder()
            sb.append(htmlHeader("Listado de Solicitudes SAIP (${solicitudes.size} registros)", "Solicitudes"))
            sb.append("<p>Generado: ${fechaFormato.format(Date())}</p>")
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th>N° Expediente</th><th>Tipo</th><th>Estado</th><th>Entidad</th><th>Solicitante</th><th>DNI</th><th>Asunto</th><th>Fecha Creación</th><th>Fecha Límite</th><th>Días Restantes</th><th>Prioridad</th></tr>")

            solicitudes.forEach { sol ->
                sb.append("<tr>")
                sb.append("<td>${escaparHtml(sol.expediente)}</td>")
                sb.append("<td>${sol.tipo.name}</td>")
                sb.append("<td>${escaparHtml(sol.estado.toDisplayString())}</td>")
                sb.append("<td>${escaparHtml(sol.entidad)}</td>")
                sb.append("<td>${escaparHtml(sol.solicitante.nombre)}</td>")
                sb.append("<td>${escaparHtml(sol.solicitante.dni)}</td>")
                sb.append("<td>${escaparHtml(sol.asunto)}</td>")
                sb.append("<td>${fechaFormato.format(Date(sol.fechaCreacion))}</td>")
                sb.append("<td>${fechaFormato.format(Date(sol.fechaLimite))}</td>")
                sb.append("<td class='number'>${sol.diasRestantes ?: "—"}</td>")
                sb.append("<td>${sol.prioridad.name}</td>")
                sb.append("</tr>")
            }

            sb.append("</table>")
            sb.append(HTML_FOOTER)
            guardarExcel(context, sb.toString(), fileName)
        } catch (e: Exception) {
            Log.e(TAG, "Error generando Excel solicitudes", e)
            null
        }
    }

    /**
     * Genera un archivo Excel (.xls) con el listado detallado de apelaciones TTAIP.
     */
    fun exportarApelacionesCSV(context: Context, apelaciones: List<Apelacion>): String? {
        return try {
            val timestamp = fechaArchivo.format(Date())
            val fileName = "MiSAIP_Apelaciones_$timestamp.xls"

            val sb = StringBuilder()
            sb.append(htmlHeader("Listado de Apelaciones TTAIP (${apelaciones.size} registros)", "Apelaciones"))
            sb.append("<p>Generado: ${fechaFormato.format(Date())}</p>")
            sb.append("<table border='1' cellspacing='0'>")
            sb.append("<tr><th>N° Expediente</th><th>Expediente SAIP</th><th>Estado</th><th>Entidad</th><th>Apelante</th><th>DNI</th><th>Asunto</th><th>Fecha Presentación</th><th>Funcionario TTAIP</th><th>1ra Calificación</th><th>2da Calificación</th></tr>")

            apelaciones.forEach { apel ->
                val primeraCalif = apel.primeraCalificacion?.resultado?.name ?: "—"
                val segundaCalif = apel.segundaCalificacion?.resultado?.name ?: "—"
                sb.append("<tr>")
                sb.append("<td>${escaparHtml(apel.expediente)}</td>")
                sb.append("<td>${escaparHtml(apel.expedienteSAIP)}</td>")
                sb.append("<td>${escaparHtml(apel.estado.toDisplayString())}</td>")
                sb.append("<td>${escaparHtml(apel.entidad)}</td>")
                sb.append("<td>${escaparHtml(apel.apelante.nombre)}</td>")
                sb.append("<td>${escaparHtml(apel.apelante.dni)}</td>")
                sb.append("<td>${escaparHtml(apel.asunto)}</td>")
                sb.append("<td>${fechaFormato.format(Date(apel.fechaPresentacion))}</td>")
                sb.append("<td>${escaparHtml(apel.funcionarioTTAIP ?: "—")}</td>")
                sb.append("<td>$primeraCalif</td>")
                sb.append("<td>$segundaCalif</td>")
                sb.append("</tr>")
            }

            sb.append("</table>")
            sb.append(HTML_FOOTER)
            guardarExcel(context, sb.toString(), fileName)
        } catch (e: Exception) {
            Log.e(TAG, "Error generando Excel apelaciones", e)
            null
        }
    }

    // =========================================================================
    // Dibujo de páginas PDF
    // =========================================================================

    private fun dibujarPaginaResumenGeneral(canvas: Canvas, state: AdminDashboardUiState) {
        val paintTitle = Paint().apply {
            color = COLOR_HEADER_TEXT; textSize = 18f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintSubtitle = Paint().apply {
            color = COLOR_TEXT_SECONDARY; textSize = 11f; isAntiAlias = true
        }
        val paintBody = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 10f; isAntiAlias = true
        }
        val paintBold = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 10f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintSection = Paint().apply {
            color = COLOR_BRAND_RED; textSize = 13f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBg = Paint().apply { color = COLOR_HEADER_BG; style = Paint.Style.FILL }
        val paintLine = Paint().apply { color = COLOR_TABLE_BORDER; strokeWidth = 1f }
        val paintNumber = Paint().apply {
            color = COLOR_BRAND_RED; textSize = 22f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }

        var y = 0f

        // Header con fondo rojo
        canvas.drawRect(0f, 0f, 595f, 70f, paintBg)
        canvas.drawText("REPORTE GENERAL — SISTEMA MiSAIP", 30f, 30f, paintTitle)
        paintTitle.textSize = 11f
        canvas.drawText("Generado: ${fechaFormato.format(Date())}", 30f, 50f, paintTitle)
        paintTitle.textSize = 18f

        y = 100f

        // Sección: Resumen Ejecutivo — Tarjetas de estadísticas
        canvas.drawText("RESUMEN EJECUTIVO", 30f, y, paintSection)
        y += 25f

        // 4 tarjetas en fila
        val cardWidth = 120f
        val cardMargin = 15f
        val startX = 30f
        val stats = listOf(
            "Solicitudes" to state.totalSolicitudes.toString(),
            "Apelaciones" to state.totalApelaciones.toString(),
            "Usuarios" to state.totalUsuarios.toString(),
            "Resueltas" to state.apelacionesResueltas.toString()
        )
        val paintCardBg = Paint().apply { color = COLOR_TABLE_HEADER; style = Paint.Style.FILL }
        val paintCardBorder = Paint().apply { color = COLOR_TABLE_BORDER; style = Paint.Style.STROKE; strokeWidth = 1f }

        stats.forEachIndexed { i, (label, value) ->
            val x = startX + i * (cardWidth + cardMargin)
            canvas.drawRect(x, y, x + cardWidth, y + 55f, paintCardBg)
            canvas.drawRect(x, y, x + cardWidth, y + 55f, paintCardBorder)
            canvas.drawText(value, x + 15f, y + 30f, paintNumber)
            canvas.drawText(label, x + 15f, y + 47f, paintSubtitle)
        }
        y += 75f

        // Línea divisoria
        canvas.drawLine(30f, y, 565f, y, paintLine)
        y += 20f

        // Sección: Solicitudes por Estado
        canvas.drawText("SOLICITUDES POR ESTADO", 30f, y, paintSection)
        y += 20f

        val solicitudesEstados = listOf(
            "Pendientes" to state.solicitudesPendientes,
            "Respondidas" to state.solicitudesRespondidas,
            "Denegadas" to state.solicitudesDenegadas,
            "Vencidas" to state.solicitudesVencidas
        )
        solicitudesEstados.forEach { (label, value) ->
            canvas.drawText("• $label:", 45f, y, paintBold)
            canvas.drawText(value.toString(), 200f, y, paintBody)
            if (state.totalSolicitudes > 0) {
                val pct = (value * 100.0 / state.totalSolicitudes)
                canvas.drawText("(%.1f%%)".format(pct), 240f, y, paintSubtitle)
            }
            y += 18f
        }
        y += 10f

        canvas.drawLine(30f, y, 565f, y, paintLine)
        y += 20f

        // Sección: Apelaciones por Estado
        canvas.drawText("APELACIONES POR ESTADO", 30f, y, paintSection)
        y += 20f

        val apelacionesEstados = listOf(
            "Pendientes" to state.apelacionesPendientes,
            "En Calificación" to state.apelacionesEnCalificacion,
            "Fundadas" to state.apelacionesFundadas,
            "Infundadas" to state.apelacionesInfundadas,
            "Resueltas (total)" to state.apelacionesResueltas
        )
        apelacionesEstados.forEach { (label, value) ->
            canvas.drawText("• $label:", 45f, y, paintBold)
            canvas.drawText(value.toString(), 200f, y, paintBody)
            if (state.totalApelaciones > 0) {
                val pct = (value * 100.0 / state.totalApelaciones)
                canvas.drawText("(%.1f%%)".format(pct), 240f, y, paintSubtitle)
            }
            y += 18f
        }
        y += 10f

        canvas.drawLine(30f, y, 565f, y, paintLine)
        y += 20f

        // Sección: Usuarios por Tipo
        canvas.drawText("USUARIOS REGISTRADOS", 30f, y, paintSection)
        y += 20f

        val usuariosTipos = listOf(
            "Ciudadanos" to state.ciudadanos,
            "Funcionarios" to state.funcionarios,
            "Vocales TTAIP" to state.vocalesTTAIP
        )
        usuariosTipos.forEach { (label, value) ->
            canvas.drawText("• $label:", 45f, y, paintBold)
            canvas.drawText(value.toString(), 200f, y, paintBody)
            y += 18f
        }

        // Pie de página
        canvas.drawLine(30f, 800f, 565f, 800f, paintLine)
        paintSubtitle.textSize = 8f
        canvas.drawText("MiSAIP — Sistema de Acceso a la Información Pública • Página 1", 30f, 820f, paintSubtitle)
    }

    private fun dibujarPaginaEntidades(canvas: Canvas, state: AdminDashboardUiState) {
        val paintTitle = Paint().apply {
            color = COLOR_HEADER_TEXT; textSize = 18f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintSection = Paint().apply {
            color = COLOR_BRAND_RED; textSize = 13f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBody = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 9f; isAntiAlias = true
        }
        val paintBold = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 9f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBg = Paint().apply { color = COLOR_HEADER_BG; style = Paint.Style.FILL }
        val paintHeaderRow = Paint().apply { color = COLOR_TABLE_HEADER; style = Paint.Style.FILL }
        val paintLine = Paint().apply { color = COLOR_TABLE_BORDER; strokeWidth = 0.5f }
        val paintSubtitle = Paint().apply {
            color = COLOR_TEXT_SECONDARY; textSize = 8f; isAntiAlias = true
        }

        // Header
        canvas.drawRect(0f, 0f, 595f, 50f, paintBg)
        canvas.drawText("ESTADÍSTICAS POR ENTIDAD", 30f, 30f, paintTitle)

        var y = 80f
        canvas.drawText("SOLICITUDES POR ENTIDAD PÚBLICA", 30f, y, paintSection)
        y += 25f

        // Tabla header
        canvas.drawRect(30f, y - 12f, 565f, y + 5f, paintHeaderRow)
        canvas.drawText("Entidad", 35f, y, paintBold)
        canvas.drawText("Total", 340f, y, paintBold)
        canvas.drawText("Pendientes", 390f, y, paintBold)
        canvas.drawText("Respondidas", 460f, y, paintBold)
        canvas.drawText("Vencidas", 530f, y, paintBold)
        y += 5f
        canvas.drawLine(30f, y, 565f, y, paintLine)
        y += 15f

        // Filas
        state.entidadesConStats.forEach { ent ->
            val nombre = if (ent.nombre.length > 45) ent.nombre.take(45) + "…" else ent.nombre
            canvas.drawText(nombre, 35f, y, paintBody)
            canvas.drawText(ent.solicitudes.toString(), 350f, y, paintBody)
            canvas.drawText(ent.pendientes.toString(), 410f, y, paintBody)
            canvas.drawText(ent.respondidas.toString(), 480f, y, paintBody)
            canvas.drawText(ent.vencidas.toString(), 540f, y, paintBody)
            y += 18f
            canvas.drawLine(30f, y - 5f, 565f, y - 5f, paintLine)
        }

        // Pie de página
        canvas.drawLine(30f, 800f, 565f, 800f, paintLine)
        canvas.drawText("MiSAIP — Sistema de Acceso a la Información Pública • Página 2", 30f, 820f, paintSubtitle)
    }

    private fun dibujarPaginaSolicitudes(
        canvas: Canvas, solicitudes: List<Solicitud>,
        pagina: Int, totalPaginas: Int, totalRegistros: Int
    ) {
        val paintTitle = Paint().apply {
            color = COLOR_HEADER_TEXT; textSize = 16f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBody = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 8f; isAntiAlias = true
        }
        val paintBold = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 8f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBg = Paint().apply { color = COLOR_HEADER_BG; style = Paint.Style.FILL }
        val paintHeaderRow = Paint().apply { color = COLOR_TABLE_HEADER; style = Paint.Style.FILL }
        val paintLine = Paint().apply { color = COLOR_TABLE_BORDER; strokeWidth = 0.5f }
        val paintSubtitle = Paint().apply {
            color = COLOR_TEXT_SECONDARY; textSize = 8f; isAntiAlias = true
        }

        // Header
        canvas.drawRect(0f, 0f, 595f, 50f, paintBg)
        canvas.drawText("LISTADO DE SOLICITUDES SAIP ($totalRegistros registros)", 30f, 25f, paintTitle)
        paintTitle.textSize = 10f
        canvas.drawText("Generado: ${fechaFormato.format(Date())}", 30f, 40f, paintTitle)

        var y = 75f

        // Tabla header
        canvas.drawRect(20f, y - 12f, 575f, y + 5f, paintHeaderRow)
        canvas.drawText("Expediente", 25f, y, paintBold)
        canvas.drawText("Estado", 140f, y, paintBold)
        canvas.drawText("Entidad", 220f, y, paintBold)
        canvas.drawText("Solicitante", 370f, y, paintBold)
        canvas.drawText("Fecha", 480f, y, paintBold)
        canvas.drawText("Días", 550f, y, paintBold)
        y += 5f
        canvas.drawLine(20f, y, 575f, y, paintLine)
        y += 15f

        solicitudes.forEach { sol ->
            val expediente = if (sol.expediente.length > 18) sol.expediente.take(18) + "…" else sol.expediente
            val entidad = if (sol.entidad.length > 22) sol.entidad.take(22) + "…" else sol.entidad
            val solicitante = if (sol.solicitante.nombre.length > 16) sol.solicitante.nombre.take(16) + "…" else sol.solicitante.nombre

            canvas.drawText(expediente, 25f, y, paintBody)
            canvas.drawText(sol.estado.toDisplayString(), 140f, y, paintBody)
            canvas.drawText(entidad, 220f, y, paintBody)
            canvas.drawText(solicitante, 370f, y, paintBody)
            canvas.drawText(fechaFormato.format(Date(sol.fechaCreacion)).take(10), 480f, y, paintBody)
            canvas.drawText((sol.diasRestantes ?: "—").toString(), 555f, y, paintBody)
            y += 16f
            canvas.drawLine(20f, y - 4f, 575f, y - 4f, paintLine)
        }

        if (solicitudes.isEmpty()) {
            canvas.drawText("No se encontraron solicitudes registradas.", 25f, y + 10f, paintBody)
        }

        // Pie de página
        canvas.drawLine(20f, 800f, 575f, 800f, paintLine)
        canvas.drawText("MiSAIP • Página $pagina de $totalPaginas", 20f, 820f, paintSubtitle)
    }

    private fun dibujarPaginaApelaciones(
        canvas: Canvas, apelaciones: List<Apelacion>,
        pagina: Int, totalPaginas: Int, totalRegistros: Int
    ) {
        val paintTitle = Paint().apply {
            color = COLOR_HEADER_TEXT; textSize = 16f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBody = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 8f; isAntiAlias = true
        }
        val paintBold = Paint().apply {
            color = COLOR_TEXT_PRIMARY; textSize = 8f; typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        val paintBg = Paint().apply { color = COLOR_HEADER_BG; style = Paint.Style.FILL }
        val paintHeaderRow = Paint().apply { color = COLOR_TABLE_HEADER; style = Paint.Style.FILL }
        val paintLine = Paint().apply { color = COLOR_TABLE_BORDER; strokeWidth = 0.5f }
        val paintSubtitle = Paint().apply {
            color = COLOR_TEXT_SECONDARY; textSize = 8f; isAntiAlias = true
        }

        // Header
        canvas.drawRect(0f, 0f, 595f, 50f, paintBg)
        canvas.drawText("LISTADO DE APELACIONES TTAIP ($totalRegistros registros)", 30f, 25f, paintTitle)
        paintTitle.textSize = 10f
        canvas.drawText("Generado: ${fechaFormato.format(Date())}", 30f, 40f, paintTitle)

        var y = 75f

        // Tabla header
        canvas.drawRect(20f, y - 12f, 575f, y + 5f, paintHeaderRow)
        canvas.drawText("Expediente", 25f, y, paintBold)
        canvas.drawText("SAIP Vinculado", 130f, y, paintBold)
        canvas.drawText("Estado", 240f, y, paintBold)
        canvas.drawText("Apelante", 350f, y, paintBold)
        canvas.drawText("Fecha", 470f, y, paintBold)
        canvas.drawText("TTAIP", 540f, y, paintBold)
        y += 5f
        canvas.drawLine(20f, y, 575f, y, paintLine)
        y += 15f

        apelaciones.forEach { apel ->
            val expediente = if (apel.expediente.length > 16) apel.expediente.take(16) + "…" else apel.expediente
            val saip = if (apel.expedienteSAIP.length > 16) apel.expedienteSAIP.take(16) + "…" else apel.expedienteSAIP
            val apelante = if (apel.apelante.nombre.length > 16) apel.apelante.nombre.take(16) + "…" else apel.apelante.nombre
            val funcionario = (apel.funcionarioTTAIP ?: "—").let {
                if (it.length > 8) it.take(8) + "…" else it
            }

            canvas.drawText(expediente, 25f, y, paintBody)
            canvas.drawText(saip, 130f, y, paintBody)
            canvas.drawText(apel.estado.toDisplayString(), 240f, y, paintBody)
            canvas.drawText(apelante, 350f, y, paintBody)
            canvas.drawText(fechaFormato.format(Date(apel.fechaPresentacion)).take(10), 470f, y, paintBody)
            canvas.drawText(funcionario, 540f, y, paintBody)
            y += 16f
            canvas.drawLine(20f, y - 4f, 575f, y - 4f, paintLine)
        }

        if (apelaciones.isEmpty()) {
            canvas.drawText("No se encontraron apelaciones registradas.", 25f, y + 10f, paintBody)
        }

        // Pie de página
        canvas.drawLine(20f, 800f, 575f, 800f, paintLine)
        canvas.drawText("MiSAIP • Página $pagina de $totalPaginas", 20f, 820f, paintSubtitle)
    }

    // =========================================================================
    // Guardado de archivos
    // =========================================================================

    /**
     * Guarda un PdfDocument en la carpeta de Descargas.
     * Usa MediaStore en Android 10+ y acceso directo en API < 29.
     */
    private fun guardarArchivo(
        context: Context,
        document: PdfDocument,
        fileName: String,
        mimeType: String
    ): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: MediaStore
            val contentValues = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MiSAIP")
            }
            val uri = context.contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues
            ) ?: return null

            context.contentResolver.openOutputStream(uri)?.use { os ->
                document.writeTo(os)
            }
            fileName
        } else {
            // API < 29: Acceso directo
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "MiSAIP")
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, fileName)
            FileOutputStream(file).use { fos ->
                document.writeTo(fos)
            }
            file.absolutePath
        }
    }

    /**
     * Guarda un string HTML como archivo .xls en la carpeta de Descargas.
     * El formato HTML-table es abierto nativamente por Excel, Google Sheets y WPS Office.
     */
    private fun guardarExcel(context: Context, content: String, fileName: String): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val contentValues = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, MIME_EXCEL)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MiSAIP")
            }
            val uri = context.contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues
            ) ?: return null

            context.contentResolver.openOutputStream(uri)?.use { os ->
                // BOM para UTF-8 — garantiza que Excel reconozca acentos
                os.write(0xEF)
                os.write(0xBB)
                os.write(0xBF)
                os.write(content.toByteArray(Charsets.UTF_8))
            }
            fileName
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "MiSAIP")
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, fileName)
            FileOutputStream(file).use { fos ->
                fos.write(0xEF)
                fos.write(0xBB)
                fos.write(0xBF)
                fos.write(content.toByteArray(Charsets.UTF_8))
            }
            file.absolutePath
        }
    }

    private fun escaparHtml(text: String): String =
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}
