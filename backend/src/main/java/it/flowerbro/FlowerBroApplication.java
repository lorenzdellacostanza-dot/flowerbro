package it.flowerbro;

import it.flowerbro.account.AccountStore;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

@SpringBootApplication
public class FlowerBroApplication {
    public static void main(String[] args) {
        SpringApplication.run(FlowerBroApplication.class, args);
    }

    @Bean
    BackendSettings backendSettings(Environment environment) {
        return BackendSettings.load(environment);
    }

    @Bean
    AccountStore accountStore(BackendSettings settings) {
        return new AccountStore(settings.databasePath(), settings.dataKey());
    }
}
