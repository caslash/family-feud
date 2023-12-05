//
//  FamiliesPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct FamiliesPanel: View {
    @State public var families: [Family]
    var body: some View {
        PanelView("Families") {
            VStack(spacing: 18) {
                Table(families) {
                    TableColumn("Family", value: \.familyName)
                    TableColumn("Points", value: \.points.description)
                }
                
                HStack {
                    Button("Update") { }
                    
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
}

#Preview {
    FamiliesPanel(families: [])
}
