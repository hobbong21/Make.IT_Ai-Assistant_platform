package com.humanad.makit.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.humanad.makit.officehub.DocumentWriteRequest;
import com.humanad.makit.officehub.OfficeHubDocumentController;
import com.humanad.makit.officehub.OfficeHubDocumentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test against the real {@link OfficeHubDocumentController} +
 * {@link OfficeHubDocumentService}. Verifies that POST/PUT request bodies are
 * sanitized end-to-end through the Spring MVC pipeline (RequestBodyAdvice +
 * service-layer sanitize) and that GET responses echo the safe stored values.
 */
@WebMvcTest(controllers = OfficeHubDocumentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({DocumentSanitizer.class, DocumentRequestSanitizingAdvice.class,
        OfficeHubDocumentService.class})
class DocumentRequestSanitizingAdviceTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    @WithMockUser
    void post_stripsScriptAndUnsafeUrlsBeforePersist() throws Exception {
        DocumentWriteRequest payload = new DocumentWriteRequest(
                "<script>alert(1)</script>Hello",
                List.of("<b>tag</b>", "<script>x</script>", "ok"),
                "# Heading\n\n"
                        + "<a href=\"javascript:alert(1)\" onclick=\"x()\">click</a>\n"
                        + "<script>bad()</script>\n"
                        + "[md](javascript:alert(1))\n"
                        + "![img](vbscript:msgbox)\n"
                        + "[ref][r1]\n\n[r1]: javascript:alert(1)\n\n"
                        + "safe text"
        );

        String body = mvc.perform(post("/api/office-hub/documents")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Hello"))
                .andExpect(jsonPath("$.tags[0]").value("tag"))
                .andExpect(jsonPath("$.tags[1]").value("ok"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsString("<script>"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsStringIgnoringCase("javascript:"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsStringIgnoringCase("vbscript:"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsStringIgnoringCase("onclick"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(containsString("about:blank")))
                .andExpect(jsonPath("$.bodyMarkdown").value(containsString("# Heading")))
                .andExpect(jsonPath("$.bodyMarkdown").value(containsString("safe text")))
                .andReturn().getResponse().getContentAsString();

        String id = json.readTree(body).get("id").asText();

        // GET must echo the same safe stored values.
        mvc.perform(get("/api/office-hub/documents/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Hello"))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsString("<script>"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsStringIgnoringCase("javascript:"))));
    }

    @Test
    @WithMockUser
    void put_alsoSanitizes() throws Exception {
        // Create first.
        DocumentWriteRequest seed = new DocumentWriteRequest("seed", List.of(), "seed body");
        String body = mvc.perform(post("/api/office-hub/documents")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(seed)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        DocumentWriteRequest update = new DocumentWriteRequest(
                "ok",
                List.of("a"),
                "[hack](JaVaScRiPt:alert(1))"
        );

        mvc.perform(put("/api/office-hub/documents/" + id)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bodyMarkdown").value(not(containsStringIgnoringCase("javascript:"))))
                .andExpect(jsonPath("$.bodyMarkdown").value(containsString("about:blank")));
    }
}
