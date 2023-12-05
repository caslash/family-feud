//
//  QuestionSelectorPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct QuestionSelectorPanel: View {
    @State private var viewmodel: QuestionSelectorViewModel
    @State private var multiplier: Int = 1
    var body: some View {
        PanelView("Question Selector") {
            VStack(spacing: 18) {
                Table(viewmodel.questions.getQuestions()) {
                    TableColumn("Done", value: \.answered.description)
                    TableColumn("#Ans", value: \.answers.count.description)
                    TableColumn("Question", value: \.question)
                }
                
                HStack {
                    Picker(selection: self.$multiplier, label: Text("MULTIPLIER")) {
                        Text("Single").tag(1)
                        Text("Double").tag(2)
                        Text("Triple").tag(3)
                    }
                    .pickerStyle(.radioGroup)
                    .horizontalRadioGroupLayout()
                    
                    Spacer()
                    
                    Button("Select") { }
                }
            }
        }
        .padding()
        .frame(width: 400, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(game: FamilyFeudGame) {
        self.viewmodel = QuestionSelectorViewModel(game: game)
    }
}

#Preview {
    QuestionSelectorPanel(game: FamilyFeudGame())
}
