package com.gestion.misaip.core.data.repository

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException

class OfflinePageFallbackTest {

    @Test
    fun `usa cache local cuando falla conectividad`() = runTest {
        val result = withOfflinePageFallback(
            remote = { throw IOException("Sin red") },
            local = { "cache-local" }
        )

        assertEquals("cache-local", result)
    }

    @Test
    fun `no oculta errores reales del backend`() = runTest {
        try {
            withOfflinePageFallback(
                remote = { throw IllegalStateException("HTTP 500") },
                local = { "cache-local" }
            )
            fail("El error backend debe propagarse")
        } catch (e: IllegalStateException) {
            assertEquals("HTTP 500", e.message)
        }
    }
}
