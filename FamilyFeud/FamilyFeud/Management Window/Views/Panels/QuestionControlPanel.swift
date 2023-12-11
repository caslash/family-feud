//
//  QuestionControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct QuestionControlPanel: View {
    @State private var viewmodel: QuestionControlViewModel
    var body: some View {
        PanelView("Question Control") {
            VStack(spacing: 18) {
                Table(self.viewmodel.answers, selection: self.$viewmodel.selectedAnswerId) {
                    TableColumn("Answer", value: \.answer)
                    TableColumn("Points", value: \.value.description)
                    TableColumn("Revealed", value: \.revealed.description)
                }
                
                HStack {
                    Button("Reveal Answer") { self.viewmodel.reveal() }
                    
                    Button("Strike") { self.viewmodel.strike() }
                }
            }
        }
        .padding()
        .frame(width: 400, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = QuestionControlViewModel(game: game, viewstateservice: viewstateservice, windowcontroller: windowcontroller)
    }
}

#Preview {
    QuestionControlPanel(game: FamilyFeudGame(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
