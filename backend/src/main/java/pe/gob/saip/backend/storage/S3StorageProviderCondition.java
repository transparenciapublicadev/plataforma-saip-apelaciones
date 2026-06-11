package pe.gob.saip.backend.storage;

import java.util.Locale;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionMessage;
import org.springframework.boot.autoconfigure.condition.ConditionOutcome;
import org.springframework.boot.autoconfigure.condition.SpringBootCondition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

public class S3StorageProviderCondition extends SpringBootCondition {

    private static final Set<String> S3_VALUES = Set.of(
            "s3",
            "s3-compatible",
            "s3_compatible");

    @Override
    public ConditionOutcome getMatchOutcome(
            ConditionContext context,
            AnnotatedTypeMetadata metadata) {
        String configured = context.getEnvironment()
                .getProperty("app.storage.provider", "local")
                .strip()
                .toLowerCase(Locale.ROOT);
        boolean enabled = S3_VALUES.contains(configured);
        ConditionMessage message = ConditionMessage
                .forCondition("S3-compatible document storage")
                .because(enabled ? "APP_STORAGE_PROVIDER selects S3" : "another provider is selected");
        return new ConditionOutcome(enabled, message);
    }
}
