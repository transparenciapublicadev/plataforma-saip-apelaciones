package pe.gob.saip.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import java.net.URI;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

public final class ApiProblemDetails {

    private static final String PROBLEM_TYPE_PREFIX = "urn:saip:problem:";

    private ApiProblemDetails() {
    }

    public static ProblemDetail create(HttpStatus status, String title, String detail, String instance) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create(PROBLEM_TYPE_PREFIX + slug(title)));
        problem.setInstance(toInstanceUri(instance));
        problem.setProperty("timestamp", OffsetDateTime.now(ZoneOffset.UTC).toString());
        problem.setProperty("success", false);
        problem.setProperty("mensaje", detail);
        return problem;
    }

    private static URI toInstanceUri(String instance) {
        String safeInstance = instance == null || instance.isBlank() ? "/" : instance;
        return URI.create(safeInstance.startsWith("/") ? safeInstance : "/" + safeInstance);
    }

    private static String slug(String value) {
        String normalized = value == null || value.isBlank() ? "error" : value;
        return normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }
}
