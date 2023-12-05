//
//  QuestionControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct QuestionControlPanel: View {
    @State public var answers: [Answer]
    var body: some View {
        PanelView("Question Control") {
            VStack(spacing: 18) {
                Table(answers) {
                    TableColumn("Answer", value: \.answer)
                    TableColumn("Points", value: \.value.description)
                    TableColumn("Revealed", value: \.revealed.description)
                }
                
                HStack {
                    Button("Reveal Answer") { }
                    
                    Button("Strike") { }
                }
            }
        }
        .padding()
        .frame(width: 400, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
}

#Preview {
    QuestionControlPanel(answers: [])
}
